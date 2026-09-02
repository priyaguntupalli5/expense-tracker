package com.expensetracker.service;

import com.expensetracker.model.Expense;
import com.expensetracker.model.FixedExpense;
import com.expensetracker.model.Income;
import com.expensetracker.repository.ExpenseRepository;
import com.expensetracker.repository.FixedExpenseRepository;
import com.expensetracker.repository.IncomeRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;

/**
 * Generates income entries and fixed-expense entries for recurring templates.
 * Runs at startup (catches up on any missed days) and daily at 6 AM.
 */
@Service
public class RecurringJobService implements ApplicationRunner {

    private final IncomeRepository       incomeRepository;
    private final FixedExpenseRepository fixedExpenseRepository;
    private final ExpenseRepository      expenseRepository;

    public RecurringJobService(IncomeRepository incomeRepository,
                               FixedExpenseRepository fixedExpenseRepository,
                               ExpenseRepository expenseRepository) {
        this.incomeRepository       = incomeRepository;
        this.fixedExpenseRepository = fixedExpenseRepository;
        this.expenseRepository      = expenseRepository;
    }

    /** Runs after schema.sql/data.sql and SchemaMigration — guaranteed post-init ordering. */
    @Override
    public void run(ApplicationArguments args) {
        generateAll(LocalDate.now());
    }

    @Scheduled(cron = "0 0 6 * * *")
    public void runDaily() {
        generateAll(LocalDate.now());
    }

    private void generateAll(LocalDate today) {
        LocalDate until = today.with(TemporalAdjusters.lastDayOfMonth());

        incomeRepository.findAll().stream()
            .filter(Income::isTemplate)
            .forEach(t -> generateForTemplate(t, until));

        fixedExpenseRepository.findAll().stream()
            .filter(fe -> fe.getStartDate() != null)
            .forEach(fe -> generateForFixedExpense(fe, until));
    }

    /** Called immediately when an income template is created/updated. */
    public void generateForTemplate(Income template) {
        LocalDate until = LocalDate.now().with(TemporalAdjusters.lastDayOfMonth());
        generateForTemplate(template, until);
    }

    /** Called immediately when a fixed expense is created/updated with a startDate. */
    public void generateForFixedExpense(FixedExpense fe) {
        LocalDate until = LocalDate.now().with(TemporalAdjusters.lastDayOfMonth());
        generateForFixedExpense(fe, until);
    }

    // ── Income generation ─────────────────────────────────────────────────────

    private void generateForTemplate(Income template, LocalDate today) {
        if (template.getStartDate() == null || template.getRecurrence() == null) return;

        List<LocalDate> dueDates = computePaymentDates(
            template.getRecurrence(), null, null, template.getStartDate(), today);

        for (LocalDate due : dueDates) {
            if (!incomeRepository.existsByTemplateIdAndPaymentDate(template.getId(), due)) {
                Income entry = new Income();
                entry.setTitle(template.getTitle());
                entry.setAmount(template.getAmount());
                entry.setSourceType(template.getSourceType());
                entry.setNotes(template.getNotes());
                entry.setGroupId(template.getGroupId());
                entry.setTemplate(false);
                entry.setTemplateId(template.getId());
                entry.setPaymentDate(due);
                incomeRepository.save(entry);
            }
        }
    }

    // ── Fixed expense → generated expense entries ─────────────────────────────

    private void generateForFixedExpense(FixedExpense fe, LocalDate today) {
        if (fe.getStartDate() == null || fe.getRecurrence() == null) return;

        // Don't generate occurrences past the expense's end date, if it has one.
        LocalDate until = (fe.getEndDate() != null && fe.getEndDate().isBefore(today)) ? fe.getEndDate() : today;

        List<LocalDate> dueDates = computePaymentDates(
            fe.getRecurrence(), null, null, fe.getStartDate(), until);

        for (LocalDate due : dueDates) {
            if (!expenseRepository.existsBySourceFixedIdAndDate(fe.getId(), due)) {
                Expense entry = new Expense();
                entry.setTitle(fe.getTitle());
                entry.setAmount(fe.getAmount());
                entry.setCategory(fe.getCategory());
                entry.setSubcategory(fe.getSubcategory());
                entry.setDate(due);
                entry.setNotes(fe.getNotes());
                entry.setGroupId(fe.getGroupId());
                entry.setSourceFixedId(fe.getId());
                expenseRepository.save(entry);
            }
        }
    }

    // ── Payment date computation ──────────────────────────────────────────────

    /**
     * Returns all payment dates in [startDate, until] for the given recurrence pattern.
     * paymentDay / paymentMonth are legacy params; pass null to derive from startDate.
     */
    public List<LocalDate> computePaymentDates(String recurrence, Integer paymentDay,
                                               Integer paymentMonth, LocalDate startDate,
                                               LocalDate until) {
        List<LocalDate> dates = new ArrayList<>();
        if (startDate == null || until == null || startDate.isAfter(until) || recurrence == null) {
            return dates;
        }

        switch (recurrence) {
            case "WEEKLY" -> {
                LocalDate d = startDate;
                if (paymentDay != null) {
                    while (d.getDayOfWeek().getValue() != paymentDay) d = d.plusDays(1);
                }
                while (!d.isAfter(until)) { dates.add(d); d = d.plusWeeks(1); }
            }
            case "BIWEEKLY" -> {
                LocalDate d = startDate;
                while (!d.isAfter(until)) { dates.add(d); d = d.plusWeeks(2); }
            }
            case "MONTHLY" -> {
                int dom = paymentDay != null ? paymentDay : startDate.getDayOfMonth();
                YearMonth ym = YearMonth.from(startDate);
                while (!ym.atDay(1).isAfter(until)) {
                    LocalDate d = ym.atDay(Math.min(dom, ym.lengthOfMonth()));
                    if (!d.isBefore(startDate) && !d.isAfter(until)) dates.add(d);
                    ym = ym.plusMonths(1);
                }
            }
            case "QUARTERLY" -> {
                int dom = paymentDay != null ? paymentDay : startDate.getDayOfMonth();
                YearMonth ym = YearMonth.from(startDate);
                while (!ym.atDay(1).isAfter(until)) {
                    LocalDate d = ym.atDay(Math.min(dom, ym.lengthOfMonth()));
                    if (!d.isBefore(startDate) && !d.isAfter(until)) dates.add(d);
                    ym = ym.plusMonths(3);
                }
            }
            case "YEARLY" -> {
                int dom = paymentDay   != null ? paymentDay   : startDate.getDayOfMonth();
                int mon = paymentMonth != null ? paymentMonth : startDate.getMonthValue();
                int year = startDate.getYear();
                while (year <= until.getYear()) {
                    YearMonth ym = YearMonth.of(year, mon);
                    LocalDate d  = ym.atDay(Math.min(dom, ym.lengthOfMonth()));
                    if (!d.isBefore(startDate) && !d.isAfter(until)) dates.add(d);
                    year++;
                }
            }
        }
        return dates;
    }
}
