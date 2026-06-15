package com.expensetracker.controller;

import com.expensetracker.model.Income;
import com.expensetracker.model.User;
import com.expensetracker.repository.IncomeRepository;
import com.expensetracker.service.RecurringJobService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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
            return repository.findByGroupIdAndIsTemplateFalseAndMonthAndYearOrderByIdDesc(groupId, month, year);
        }
        return repository.findByGroupIdAndIsTemplateFalseOrderByYearDescMonthDescIdDesc(groupId);
    }

    /** Monthly income total (non-template entries only). */
    @GetMapping("/total")
    public Map<String, BigDecimal> getTotal(@AuthenticationPrincipal User user,
                                            @RequestParam int month,
                                            @RequestParam int year) {
        BigDecimal total = repository.sumByGroupIdAndMonthAndYear(user.getGroup().getId(), month, year);
        return Map.of("total", total);
    }

    @PostMapping
    public Income create(@AuthenticationPrincipal User user, @RequestBody Income income) {
        income.setGroupId(user.getGroup().getId());
        // If recurring template, auto-generate past-due entries immediately
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
                existing.setMonth(income.getMonth());
                existing.setYear(income.getYear());
                existing.setNotes(income.getNotes());
                existing.setRecurrence(income.getRecurrence());
                existing.setPaymentDay(income.getPaymentDay());
                existing.setPaymentMonth(income.getPaymentMonth());
                existing.setStartDate(income.getStartDate());
                Income saved = repository.save(existing);
                // Re-run generation if this is a template
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
