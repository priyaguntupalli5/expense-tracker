package com.expensetracker.controller;

import com.expensetracker.model.FixedExpense;
import com.expensetracker.model.User;
import com.expensetracker.repository.FixedExpenseRepository;
import com.expensetracker.service.RecurringJobService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/fixed-expenses")
public class FixedExpenseController {

    private final FixedExpenseRepository repository;
    private final RecurringJobService    recurringJobService;

    public FixedExpenseController(FixedExpenseRepository repository,
                                  RecurringJobService recurringJobService) {
        this.repository          = repository;
        this.recurringJobService = recurringJobService;
    }

    @GetMapping
    public List<FixedExpense> getAll(@AuthenticationPrincipal User user) {
        return repository.findByGroupId(user.getGroup().getId());
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal User user,
                                    @Valid @RequestBody FixedExpense expense) {
        if (expense.getEndDate() != null && expense.getStartDate() != null
            && expense.getEndDate().isBefore(expense.getStartDate())) {
            return ResponseEntity.badRequest().body(Map.of("error", "End date cannot be before the first payment date."));
        }
        expense.setId(null);
        expense.setGroupId(user.getGroup().getId());
        FixedExpense saved = repository.save(expense);
        if (saved.getStartDate() != null) recurringJobService.generateForFixedExpense(saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@AuthenticationPrincipal User user,
                                    @PathVariable Long id,
                                    @Valid @RequestBody FixedExpense updated) {
        if (updated.getEndDate() != null && updated.getStartDate() != null
            && updated.getEndDate().isBefore(updated.getStartDate())) {
            return ResponseEntity.badRequest().body(Map.of("error", "End date cannot be before the first payment date."));
        }
        return repository.findByIdAndGroupId(id, user.getGroup().getId()).map(existing -> {
            existing.setTitle(updated.getTitle());
            existing.setAmount(updated.getAmount());
            existing.setCategory(updated.getCategory());
            existing.setNotes(updated.getNotes());
            existing.setSubcategory(updated.getSubcategory());
            existing.setRecurrence(updated.getRecurrence());
            existing.setStartDate(updated.getStartDate());
            existing.setEndDate(updated.getEndDate());
            FixedExpense saved = repository.save(existing);
            // Always run: besides filling in due entries, it removes ones now outside the date range
            recurringJobService.generateForFixedExpense(saved);
            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
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
