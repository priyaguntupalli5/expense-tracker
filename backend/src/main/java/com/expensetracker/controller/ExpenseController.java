package com.expensetracker.controller;

import com.expensetracker.model.Expense;
import com.expensetracker.model.SummaryDTO;
import com.expensetracker.model.User;
import com.expensetracker.service.ExpenseService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService service;

    public ExpenseController(ExpenseService service) {
        this.service = service;
    }

    @GetMapping
    public List<Expense> getAll(
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Integer month,
        @RequestParam(required = false) Integer year,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return service.getAll(user.getGroup().getId(), month, year, startDate, endDate);
    }

    @GetMapping("/summary")
    public SummaryDTO getSummary(
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Integer month,
        @RequestParam(required = false) Integer year,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate
    ) {
        return service.getSummary(user.getGroup().getId(), month, year, toDate);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Expense> getById(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return service.getById(id, user.getGroup().getId())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Expense> create(@AuthenticationPrincipal User user, @Valid @RequestBody Expense expense) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(expense, user.getGroup().getId()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Expense> update(@AuthenticationPrincipal User user,
                                          @PathVariable Long id,
                                          @Valid @RequestBody Expense expense) {
        return service.update(id, user.getGroup().getId(), expense)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return service.delete(id, user.getGroup().getId())
            ? ResponseEntity.noContent().build()
            : ResponseEntity.notFound().build();
    }
}
