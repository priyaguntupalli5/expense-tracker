package com.expensetracker.controller;

import com.expensetracker.model.Expense;
import com.expensetracker.model.SummaryDTO;
import com.expensetracker.service.ExpenseService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
        @RequestParam(required = false) Integer month,
        @RequestParam(required = false) Integer year
    ) {
        return service.getAll(month, year);
    }

    @GetMapping("/summary")
    public SummaryDTO getSummary(
        @RequestParam(required = false) Integer month,
        @RequestParam(required = false) Integer year
    ) {
        return service.getSummary(month, year);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Expense> getById(@PathVariable Long id) {
        return service.getById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Expense> create(@Valid @RequestBody Expense expense) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(expense));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Expense> update(@PathVariable Long id, @Valid @RequestBody Expense expense) {
        return service.update(id, expense)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return service.delete(id)
            ? ResponseEntity.noContent().build()
            : ResponseEntity.notFound().build();
    }
}
