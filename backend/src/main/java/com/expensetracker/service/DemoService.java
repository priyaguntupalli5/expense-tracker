package com.expensetracker.service;

import com.expensetracker.dto.AuthResponse;
import com.expensetracker.model.*;
import com.expensetracker.repository.*;
import com.expensetracker.security.JwtUtil;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

/**
 * "Try the demo": gives each visitor a throwaway group filled with sample data dated relative to
 * today, so the dashboard always looks current. Demo groups have no invite code (nobody can join
 * them) and are deleted with all their data once they're older than LIFETIME.
 */
@Service
public class DemoService {

    public static final Duration LIFETIME = Duration.ofHours(24);
    // Expires well before the group is deleted, so no live session ever points at a deleted user
    private static final Duration SESSION = Duration.ofHours(4);
    // Across all visitors — Lambda instances share no memory, so the count comes from the DB
    static final int MAX_PER_HOUR = 30;

    public static final String NOT_IN_DEMO = "That's turned off in the demo.";

    // Every group-owned table, children before parents. Cleanup deletes from each, in this order.
    private static final List<String> GROUP_TABLES = List.of(
        "expenses", "fixed_expenses", "income_entries", "savings_entries", "bank_accounts",
        "group_subcategories", "group_categories", "join_requests", "users");

    private final GroupRepository         groupRepo;
    private final UserRepository          userRepo;
    private final GroupCategoryRepository groupCategoryRepo;
    private final ExpenseRepository       expenseRepo;
    private final FixedExpenseRepository  fixedExpenseRepo;
    private final IncomeRepository        incomeRepo;
    private final BankAccountRepository   bankAccountRepo;
    private final SavingsEntryRepository  savingsRepo;
    private final CategorySeederService   categorySeeder;
    private final RecurringJobService     recurringJobService;
    private final PasswordEncoder         passwordEncoder;
    private final JwtUtil                 jwtUtil;
    private final JdbcTemplate            jdbc;

    public DemoService(GroupRepository groupRepo, UserRepository userRepo,
                       GroupCategoryRepository groupCategoryRepo, ExpenseRepository expenseRepo,
                       FixedExpenseRepository fixedExpenseRepo, IncomeRepository incomeRepo,
                       BankAccountRepository bankAccountRepo, SavingsEntryRepository savingsRepo,
                       CategorySeederService categorySeeder, RecurringJobService recurringJobService,
                       PasswordEncoder passwordEncoder, JwtUtil jwtUtil, JdbcTemplate jdbc) {
        this.groupRepo           = groupRepo;
        this.userRepo            = userRepo;
        this.groupCategoryRepo   = groupCategoryRepo;
        this.expenseRepo         = expenseRepo;
        this.fixedExpenseRepo    = fixedExpenseRepo;
        this.incomeRepo          = incomeRepo;
        this.bankAccountRepo     = bankAccountRepo;
        this.savingsRepo         = savingsRepo;
        this.categorySeeder      = categorySeeder;
        this.recurringJobService = recurringJobService;
        this.passwordEncoder     = passwordEncoder;
        this.jwtUtil             = jwtUtil;
        this.jdbc                = jdbc;
    }

    /** Creates and fills a demo group, or returns empty when the hourly cap is reached. */
    @Transactional
    public Optional<AuthResponse> create() {
        if (groupRepo.countByDemoTrueAndCreatedAtAfter(LocalDateTime.now().minusHours(1)) >= MAX_PER_HOUR) {
            return Optional.empty();
        }

        String suffix;
        do {
            suffix = UUID.randomUUID().toString().substring(0, 8);
        } while (groupRepo.existsByName("Demo " + suffix) || userRepo.existsByUsername("demo-" + suffix));

        Group group = new Group();
        group.setName("Demo " + suffix);
        group.setDemo(true);   // no group code: a demo group can't be joined
        group = groupRepo.save(group);
        categorySeeder.seedForGroup(group.getId());

        User user = new User();
        user.setUsername("demo-" + suffix);
        user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString())); // never shown, so never usable
        user.setGroup(group);
        user.setAdmin(true);
        userRepo.save(user);

        seed(group.getId(), LocalDate.now());

        String token = jwtUtil.generate(user.getUsername(), group.getId(), SESSION.toMillis());
        return Optional.of(new AuthResponse(token, user.getUsername(), group.getName(), null, true));
    }

    /**
     * Deletes demo groups older than LIFETIME along with everything they own. Every statement is
     * restricted to groups with is_demo = TRUE, so real groups can't be touched.
     * Locally this runs on its own schedule; on Lambda, JobController calls it with the daily job.
     */
    @Scheduled(cron = "0 30 6 * * *")
    @Transactional
    public int deleteExpired() {
        Timestamp cutoff = Timestamp.valueOf(LocalDateTime.now().minus(LIFETIME));
        String expired = "SELECT id FROM `groups` WHERE is_demo = TRUE AND created_at < ?";

        jdbc.update("DELETE FROM expense_tags WHERE expense_id IN "
                  + "(SELECT id FROM expenses WHERE group_id IN (" + expired + "))", cutoff);
        jdbc.update("DELETE FROM bank_account_tags WHERE bank_account_id IN "
                  + "(SELECT id FROM bank_accounts WHERE group_id IN (" + expired + "))", cutoff);
        for (String table : GROUP_TABLES) {
            jdbc.update("DELETE FROM " + table + " WHERE group_id IN (" + expired + ")", cutoff);
        }
        return jdbc.update("DELETE FROM `groups` WHERE is_demo = TRUE AND created_at < ?", cutoff);
    }

    // ── Sample data ───────────────────────────────────────────────────────────

    private record Spend(String titles, String category, String subcategory, int min, int max, int perMonth) {}
    private record OneOff(int monthsAgo, int day, String title, String category, String subcategory,
                          String amount, String... tags) {}

    // Everyday spending; titles are "|"-separated alternatives
    private static final List<Spend> SPENDING = List.of(
        new Spend("Groceries|Costco run|Farmers market|Grocery top-up", "FOOD", "Groceries", 35, 165, 5),
        new Spend("Coffee|Latte|Coffee with a friend", "FOOD", "Coffee & Drinks", 4, 8, 6),
        new Spend("Dinner out|Sushi night|Brunch", "FOOD", "Restaurants", 35, 95, 2),
        new Spend("Pizza delivery|Thai takeout", "FOOD", "Takeout / Delivery", 22, 48, 2),
        new Spend("Gas", "TRANSPORT", "Gas / Fuel", 50, 78, 3),
        new Spend("Transit top-up", "TRANSPORT", "Public Transit", 25, 50, 1),
        new Spend("Parking downtown", "TRANSPORT", "Parking", 8, 22, 1),
        new Spend("Electricity bill", "HOUSING", "Electricity", 68, 112, 1),
        new Spend("Movie night|Bowling", "ENTERTAINMENT", "Movies & Shows", 18, 38, 1),
        new Spend("Pharmacy", "HEALTH", "Pharmacy", 12, 42, 1),
        new Spend("New shirt|Running shoes|Jeans", "SHOPPING", "Clothing", 40, 120, 1),
        new Spend("Household supplies", "SHOPPING", "Home & Decor", 20, 70, 1));

    // One-time events in past months, so every month looks a little different
    private static final List<OneOff> ONE_OFFS = List.of(
        new OneOff(3, 9,  "Dentist cleaning", "HEALTH", "Dentist", "120.00"),
        new OneOff(3, 22, "Concert tickets", "ENTERTAINMENT", "Events & Concerts", "138.00"),
        new OneOff(2, 6,  "Flight to Vancouver", "TRANSPORT", null, "412.00", "vacation"),
        new OneOff(2, 7,  "Hotel – Vancouver", "OTHER", "Miscellaneous", "564.00", "vacation"),
        new OneOff(2, 8,  "Whale watching tour", "ENTERTAINMENT", "Events & Concerts", "145.00", "vacation"),
        new OneOff(2, 9,  "Seafood dinner", "FOOD", "Restaurants", "96.50", "vacation"),
        new OneOff(2, 19, "Online course – SQL", "EDUCATION", "Online Courses", "29.99", "work"),
        new OneOff(1, 4,  "Noise-cancelling headphones", "SHOPPING", "Electronics", "329.99"),
        new OneOff(1, 14, "Team lunch", "FOOD", "Restaurants", "42.00", "work"),
        new OneOff(1, 21, "Birthday gift for Sam", "SHOPPING", "Gifts", "65.00"),
        new OneOff(1, 18, "Headphones price adjustment", "REFUND", "Price Adjustment", "40.00"),
        new OneOff(2, 27, "Returned jacket", "REFUND", "Store Credit", "79.99"));

    private void seed(Long groupId, LocalDate today) {
        // Seeded so every visitor sees the same believable data; only the dates move
        Random rnd = new Random(42);
        YearMonth current = YearMonth.from(today);
        YearMonth first = current.minusMonths(3);
        // Skip anything whose category this database doesn't have (e.g. no REFUND category)
        Set<String> categories = groupCategoryRepo.findByGroupId(groupId).stream()
            .map(GroupCategory::getValue).collect(Collectors.toSet());

        List<Expense> expenses = new ArrayList<>();
        for (YearMonth ym = first; !ym.isAfter(current); ym = ym.plusMonths(1)) {
            int lastDay = ym.equals(current) ? today.getDayOfMonth() : ym.lengthOfMonth();
            for (Spend s : SPENDING) {
                if (!categories.contains(s.category())) continue;
                String[] titles = s.titles().split("\\|");
                // the current month only gets its share up to today
                int count = Math.max(1, s.perMonth() * lastDay / ym.lengthOfMonth());
                for (int i = 0; i < count; i++) {
                    BigDecimal amount = BigDecimal.valueOf(
                        s.min() * 100L + rnd.nextInt((s.max() - s.min()) * 100 + 1), 2);
                    expenses.add(expense(groupId, titles[rnd.nextInt(titles.length)], s.category(),
                        s.subcategory(), amount, ym.atDay(1 + rnd.nextInt(lastDay))));
                }
            }
        }
        for (OneOff o : ONE_OFFS) {
            if (!categories.contains(o.category())) continue;
            YearMonth ym = current.minusMonths(o.monthsAgo());
            Expense e = expense(groupId, o.title(), o.category(), o.subcategory(), new BigDecimal(o.amount()),
                ym.atDay(Math.min(o.day(), ym.lengthOfMonth())));
            e.setTags(new LinkedHashSet<>(List.of(o.tags())));
            expenses.add(e);
        }
        expenseRepo.saveAll(expenses);

        LocalDate firstDay = first.atDay(1);
        fixed(groupId, "Rent", "HOUSING", "Rent / Mortgage", "1650.00", firstDay, categories);
        fixed(groupId, "Internet", "HOUSING", "Internet", "75.00", firstDay.withDayOfMonth(12), categories);
        fixed(groupId, "Car insurance", "TRANSPORT", "Car Insurance", "142.00", firstDay.withDayOfMonth(5), categories);
        fixed(groupId, "Gym membership", "HEALTH", "Gym & Fitness", "45.00", firstDay.withDayOfMonth(3), categories);
        fixed(groupId, "Netflix", "ENTERTAINMENT", "Streaming Services", "20.99", firstDay.withDayOfMonth(15), categories);
        fixed(groupId, "Spotify", "ENTERTAINMENT", "Streaming Services", "11.99", firstDay.withDayOfMonth(20), categories);

        Income salary = new Income();
        salary.setTitle("Salary");
        salary.setAmount(new BigDecimal("2450.00"));
        salary.setSourceType("SALARY");
        salary.setNotes("Northwind Ltd.");
        salary.setGroupId(groupId);
        salary.setTemplate(true);
        salary.setRecurrence("BIWEEKLY");
        salary.setStartDate(firstDay.with(TemporalAdjusters.nextOrSame(DayOfWeek.FRIDAY)));
        recurringJobService.generateForTemplate(incomeRepo.save(salary));

        Income freelance = new Income();
        freelance.setTitle("Website for a local bakery");
        freelance.setAmount(new BigDecimal("850.00"));
        freelance.setSourceType("FREELANCE");
        freelance.setGroupId(groupId);
        freelance.setPaymentDate(current.minusMonths(2).atDay(18));
        incomeRepo.save(freelance);

        seedSavings(groupId, first, current);
    }

    private void seedSavings(Long groupId, YearMonth first, YearMonth current) {
        BankAccount chequing  = account(groupId, "Chequing", "3200.00");
        BankAccount tfsa      = account(groupId, "TFSA", "8500.00", "long-term");
        BankAccount emergency = account(groupId, "Emergency Fund", "5000.00", "safety net");

        List<SavingsEntry> entries = new ArrayList<>();
        for (YearMonth ym = first; !ym.isAfter(current); ym = ym.plusMonths(1)) {
            entries.add(saving(groupId, emergency, ym, "250.00", "CASH", "Monthly top-up"));
            entries.add(saving(groupId, tfsa, ym, "500.00", "INVESTMENT", "Index fund contribution"));
            entries.add(saving(groupId, chequing, ym, "300.00", "CASH", null));
        }
        // The vacation month dipped into savings
        entries.add(saving(groupId, chequing, current.minusMonths(2), "-600.00", "CASH", "Vancouver trip"));
        savingsRepo.saveAll(entries);

        // Linked pair, as SavingsService.transfer() creates them
        YearMonth ym = current.minusMonths(1);
        SavingsEntry out = saving(groupId, chequing, ym, "-1000.00", "CASH", "Moved to TFSA");
        SavingsEntry in  = saving(groupId, tfsa, ym, "1000.00", "CASH", "Moved to TFSA");
        out.setIsTransfer(true);
        in.setIsTransfer(true);
        out = savingsRepo.save(out);
        in  = savingsRepo.save(in);
        out.setLinkedEntryId(in.getId());
        in.setLinkedEntryId(out.getId());
        savingsRepo.saveAll(List.of(out, in));
    }

    private static Expense expense(Long groupId, String title, String category, String subcategory,
                                   BigDecimal amount, LocalDate date) {
        Expense e = new Expense();
        e.setGroupId(groupId);
        e.setTitle(title);
        e.setCategory(category);
        e.setSubcategory(subcategory);
        e.setAmount(amount);
        e.setDate(date);
        return e;
    }

    private void fixed(Long groupId, String title, String category, String subcategory, String amount,
                       LocalDate startDate, Set<String> categories) {
        if (!categories.contains(category)) return;
        FixedExpense fe = new FixedExpense();
        fe.setGroupId(groupId);
        fe.setTitle(title);
        fe.setCategory(category);
        fe.setSubcategory(subcategory);
        fe.setAmount(new BigDecimal(amount));
        fe.setRecurrence("MONTHLY");
        fe.setStartDate(startDate);
        recurringJobService.generateForFixedExpense(fixedExpenseRepo.save(fe));
    }

    private BankAccount account(Long groupId, String name, String openingBalance, String... tags) {
        BankAccount a = new BankAccount();
        a.setGroupId(groupId);
        a.setOwnerName("Alex");
        a.setAccountName(name);
        a.setOpeningBalance(new BigDecimal(openingBalance));
        a.setTags(new LinkedHashSet<>(List.of(tags)));
        return bankAccountRepo.save(a);
    }

    private static SavingsEntry saving(Long groupId, BankAccount account, YearMonth ym, String amount,
                                       String assetType, String note) {
        SavingsEntry s = new SavingsEntry();
        s.setGroupId(groupId);
        s.setBankAccountId(account.getId());
        s.setMonth(ym.getMonthValue());
        s.setYear(ym.getYear());
        s.setAmount(new BigDecimal(amount));
        s.setAssetType(assetType);
        s.setNote(note);
        return s;
    }
}
