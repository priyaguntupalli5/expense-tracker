package com.expensetracker.controller;

import com.expensetracker.model.Income;
import com.expensetracker.model.User;
import com.expensetracker.repository.IncomeRepository;
import com.expensetracker.service.RecurringJobService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/income")
public class IncomeController {

    private final IncomeRepository repository;
    private final RecurringJobService recurringJobService;

    public IncomeController(IncomeRepository repository, RecurringJobService recurringJobService) {
        this.repository          = repository;
        this.recurringJobService = recurringJobService;
    }

    /** Recurring templates for the group (not period-filtered). */
    @GetMapping("/templates")
    public List<Income> getTemplates(@AuthenticationPrincipal User user) {
        return repository.findByGroupIdAndIsTemplateTrue(user.getGroup().getId());
    }

    /** Actual (non-template) entries, optionally filtered by month/year. */
    @GetMapping
    public List<Income> getAll(@AuthenticationPrincipal User user,
                               @RequestParam(required = false) Integer month,
                               @RequestParam(required = false) Integer year) {
        Long groupId = user.getGroup().getId();
        if (month != null && year != null) {
            LocalDate start = LocalDate.of(year, month, 1);
            LocalDate end   = start.withDayOfMonth(start.lengthOfMonth());
            return repository.findByGroupIdAndIsTemplateFalseAndPaymentDateBetweenOrderByPaymentDateDesc(
                    groupId, start, end);
        }
        return repository.findByGroupIdAndIsTemplateFalseOrderByPaymentDateDesc(groupId);
    }

    /**
     * Monthly income total for the dashboard.
     *
     * to-date (toDate present)   → manual entries + template payments up to toDate.
     * end-of-month (toDate null) → manual entries + template payments for the full month.
     *
     * Auto-generated rows (templateId NOT NULL) are excluded from the DB sum and replaced
     * by template projection so we never double-count regardless of what's been generated.
     */
    @GetMapping("/total")
    public Map<String, BigDecimal> getTotal(@AuthenticationPrincipal User user,
                                            @RequestParam int month,
                                            @RequestParam int year,
                                            @RequestParam(required = false)
                                            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        Long groupId = user.getGroup().getId();

        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end   = (toDate != null) ? toDate : start.withDayOfMonth(start.lengthOfMonth());

        // Manual (non-recurring) entries in the window
        BigDecimal total = repository.sumManualByGroupIdAndDateRange(groupId, start, end);

        // Project template payments within [start, end]
        for (Income template : repository.findByGroupIdAndIsTemplateTrue(groupId)) {
            if (template.getStartDate() == null || template.getRecurrence() == null) continue;
            long count = recurringJobService
                .computePaymentDates(template.getRecurrence(), null, null,
                                     template.getStartDate(), end)
                .stream()
                .filter(d -> !d.isBefore(start))
                .count();
            if (count > 0) {
                total = total.add(template.getAmount().multiply(BigDecimal.valueOf(count)));
            }
        }

        return Map.of("total", total);
    }

    @PostMapping
    public Income create(@AuthenticationPrincipal User user, @RequestBody Income income) {
        income.setGroupId(user.getGroup().getId());
        if (income.isTemplate() && income.getStartDate() != null) {
            income = repository.save(income);
            recurringJobService.generateForTemplate(income);
            return income;
        }
        return repository.save(income);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Income> update(@AuthenticationPrincipal User user,
                                         @PathVariable Long id,
                                         @RequestBody Income income) {
        return repository.findByIdAndGroupId(id, user.getGroup().getId())
            .map(existing -> {
                existing.setTitle(income.getTitle());
                existing.setAmount(income.getAmount());
                existing.setSourceType(income.getSourceType());
                existing.setPaymentDate(income.getPaymentDate());
                existing.setNotes(income.getNotes());
                existing.setRecurrence(income.getRecurrence());
                existing.setStartDate(income.getStartDate());
                Income saved = repository.save(existing);
                if (saved.isTemplate() && saved.getStartDate() != null) {
                    recurringJobService.generateForTemplate(saved);
                }
                return ResponseEntity.ok(saved);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        if (!repository.existsByIdAndGroupId(id, user.getGroup().getId())) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
