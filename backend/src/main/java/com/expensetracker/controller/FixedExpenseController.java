package com.expensetracker.controller;

import com.expensetracker.model.FixedExpense;
import com.expensetracker.repository.FixedExpenseRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fixed-expenses")
@CrossOrigin(origins = "http://localhost:4200")
public class FixedExpenseController {

    private final FixedExpenseRepository repository;

    public FixedExpenseController(FixedExpenseRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<FixedExpense> getAll() {
        return repository.findAll();
    }

    @PostMapping
    public ResponseEntity<FixedExpense> create(@Valid @RequestBody FixedExpense expense) {
        expense.setId(null);
        return ResponseEntity.status(HttpStatus.CREATED).body(repository.save(expense));
    }

    @PutMapping("/{id}")
    public ResponseEntity<FixedExpense> update(@PathVariable Long id, @Valid @RequestBody FixedExpense updated) {
        return repository.findById(id).map(existing -> {
            existing.setTitle(updated.getTitle());
            existing.setAmount(updated.getAmount());
            existing.setCategory(updated.getCategory());
            existing.setNotes(updated.getNotes());
            return ResponseEntity.ok(repository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repository.existsById(id)) return ResponseEntity.notFound().build();
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
