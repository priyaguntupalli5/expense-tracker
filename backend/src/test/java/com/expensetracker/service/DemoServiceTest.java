package com.expensetracker.service;

import com.expensetracker.dto.AuthResponse;
import com.expensetracker.model.*;
import com.expensetracker.repository.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs against an in-memory H2 database (schema generated from the entities) rather than TiDB.
 * The cleanup test is the important one: deleteExpired() must never touch a real group.
 */
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:demo;MODE=MySQL;DATABASE_TO_LOWER=TRUE;NON_KEYWORDS=VALUE,MONTH,YEAR",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.sql.init.mode=never",
    "app.startup-jobs.enabled=false",
    "app.scheduling.enabled=false",
    "jwt.secret=test-secret-test-secret-test-secret-1234",
})
@Transactional
class DemoServiceTest {

    @Autowired DemoService demoService;
    @Autowired GroupRepository groupRepo;
    @Autowired UserRepository userRepo;
    @Autowired ExpenseRepository expenseRepo;
    @Autowired BankAccountRepository bankAccountRepo;
    @Autowired SavingsEntryRepository savingsRepo;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;

    @BeforeEach
    void defaultCategories() {
        jdbc.update("""
            INSERT INTO categories (value, label, icon, color, is_income) VALUES
              ('FOOD', 'Food', 'restaurant', '#e91e63', FALSE),
              ('TRANSPORT', 'Transport', 'directions_car', '#2196f3', FALSE),
              ('HOUSING', 'Housing', 'home', '#ff9800', FALSE),
              ('ENTERTAINMENT', 'Entertainment', 'movie', '#9c27b0', FALSE),
              ('HEALTH', 'Health', 'local_hospital', '#4caf50', FALSE),
              ('SHOPPING', 'Shopping', 'shopping_cart', '#00bcd4', FALSE),
              ('EDUCATION', 'Education', 'school', '#ff5722', FALSE),
              ('OTHER', 'Other', 'more_horiz', '#607d8b', FALSE),
              ('REFUND', 'Refunds & Credits', 'payments', '#4caf50', TRUE)""");
    }

    @Test
    void createsAFilledDemoGroupThatCannotBeJoined() {
        AuthResponse res = demoService.create().orElseThrow();
        em.flush();

        assertThat(res.demo()).isTrue();
        assertThat(res.groupCode()).isNull();
        Group group = userRepo.findByUsername(res.username()).orElseThrow().getGroup();
        assertThat(group.isDemo()).isTrue();
        assertThat(group.getGroupCode()).isNull();

        Long gid = group.getId();
        assertThat(count("expenses", gid)).isGreaterThan(60);
        assertThat(count("fixed_expenses", gid)).isEqualTo(6);
        assertThat(count("income_entries", gid)).isGreaterThan(6);
        assertThat(count("bank_accounts", gid)).isEqualTo(3);
        assertThat(count("savings_entries", gid)).isGreaterThan(12);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM expenses WHERE group_id = ? AND category = 'REFUND'",
            Long.class, gid)).isEqualTo(2);
        // Nothing dated in the future except recurring entries the app itself generates for this month
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM expenses WHERE group_id = ? AND date > ? AND source_fixed_id IS NULL",
            Long.class, gid, LocalDate.now())).isZero();
    }

    @Test
    void cleanupDeletesOnlyExpiredDemoGroups() {
        Long realGid    = realGroupWithData();
        Long expiredGid = groupOf(demoService.create().orElseThrow());
        Long freshGid   = groupOf(demoService.create().orElseThrow());
        // In production create() and deleteExpired() run in separate transactions; here they share
        // the test's, so write everything out first, as a commit would
        em.flush();
        em.clear();
        // Make the real group and one demo look two days old
        jdbc.update("UPDATE `groups` SET created_at = DATEADD('DAY', -2, CURRENT_TIMESTAMP) WHERE id IN (?, ?)",
            realGid, expiredGid);

        assertThat(demoService.deleteExpired()).isEqualTo(1);

        assertThat(groupRepo.existsById(expiredGid)).isFalse();
        for (String table : List.of("users", "expenses", "fixed_expenses", "income_entries", "savings_entries",
                                    "bank_accounts", "group_categories", "group_subcategories")) {
            assertThat(count(table, expiredGid)).as(table).isZero();
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM expense_tags WHERE expense_id NOT IN "
            + "(SELECT id FROM expenses)", Long.class)).isZero();

        // The real group is older than any demo and still completely intact
        assertThat(groupRepo.existsById(realGid)).isTrue();
        assertThat(count("users", realGid)).isEqualTo(1);
        assertThat(count("expenses", realGid)).isEqualTo(1);
        assertThat(count("bank_accounts", realGid)).isEqualTo(1);
        assertThat(count("savings_entries", realGid)).isEqualTo(1);
        assertThat(expenseRepo.findByGroupIdAndSourceFixedIdIsNullOrderByDateDesc(realGid).get(0).getTags())
            .containsExactly("keep");
        // A demo still within its lifetime stays
        assertThat(groupRepo.existsById(freshGid)).isTrue();
        assertThat(count("expenses", freshGid)).isPositive();
    }

    @Test
    void refusesNewDemosOnceTheHourlyCapIsReached() {
        for (int i = 0; i < DemoService.MAX_PER_HOUR; i++) {
            Group g = new Group();
            g.setName("Demo cap " + i);
            g.setDemo(true);
            groupRepo.save(g);
        }
        assertThat(demoService.create()).isEmpty();
    }

    private Long realGroupWithData() {
        Group g = new Group();
        g.setName("Household");
        g.setGroupCode("123456");
        g = groupRepo.save(g);

        User u = new User();
        u.setUsername("real-user");
        u.setPassword("x");
        u.setGroup(g);
        userRepo.save(u);

        Expense e = new Expense();
        e.setGroupId(g.getId());
        e.setTitle("Groceries");
        e.setCategory("FOOD");
        e.setAmount(new BigDecimal("50.00"));
        e.setDate(LocalDate.now());
        e.setTags(new java.util.LinkedHashSet<>(Set.of("keep")));
        expenseRepo.save(e);

        BankAccount a = new BankAccount();
        a.setGroupId(g.getId());
        a.setOwnerName("Me");
        a.setAccountName("Savings");
        a.setTags(new java.util.LinkedHashSet<>(Set.of("keep")));
        a = bankAccountRepo.save(a);

        SavingsEntry s = new SavingsEntry();
        s.setGroupId(g.getId());
        s.setBankAccountId(a.getId());
        s.setMonth(1);
        s.setYear(2026);
        s.setAmount(new BigDecimal("100.00"));
        savingsRepo.save(s);
        return g.getId();
    }

    private Long groupOf(AuthResponse res) {
        return userRepo.findByUsername(res.username()).orElseThrow().getGroup().getId();
    }

    private long count(String table, Long groupId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE group_id = ?", Long.class, groupId);
    }
}
