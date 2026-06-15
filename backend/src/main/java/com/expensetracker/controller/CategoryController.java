package com.expensetracker.controller;

import com.expensetracker.model.Category;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.ExpenseRepository;
import com.expensetracker.repository.FixedExpenseRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryRepository categoryRepo;
    private final ExpenseRepository expenseRepo;
    private final FixedExpenseRepository fixedExpenseRepo;

    public CategoryController(CategoryRepository categoryRepo,
                              ExpenseRepository expenseRepo,
                              FixedExpenseRepository fixedExpenseRepo) {
        this.categoryRepo = categoryRepo;
        this.expenseRepo = expenseRepo;
        this.fixedExpenseRepo = fixedExpenseRepo;
    }

    @GetMapping
    public List<Category> getAll() {
        return categoryRepo.findAll();
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Category body) {
        String value = toValue(body.getLabel());
        if (categoryRepo.existsByValue(value)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "A category named \"" + body.getLabel() + "\" already exists."));
        }
        Category c = new Category();
        c.setValue(value);
        c.setLabel(body.getLabel().trim());
        c.setIcon(body.getIcon());
        c.setColor(body.getColor());
        return ResponseEntity.ok(categoryRepo.save(c));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Category body) {
        return categoryRepo.findById(id).map(existing -> {
            String newValue = toValue(body.getLabel());
            if (categoryRepo.existsByValueAndIdNot(newValue, id)) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "A category named \"" + body.getLabel() + "\" already exists."));
            }
            existing.setLabel(body.getLabel().trim());
            existing.setIcon(body.getIcon());
            existing.setColor(body.getColor());
            return ResponseEntity.ok(categoryRepo.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        return categoryRepo.findById(id).map(category -> {
            long inUse = expenseRepo.countByCategory(category.getValue())
                       + fixedExpenseRepo.countByCategory(category.getValue());
            if (inUse > 0) {
                return ResponseEntity.badRequest().body(
                        Map.of("error", "Cannot delete: this category is used by " + inUse + " expense(s)."));
            }
            categoryRepo.delete(category);
            return ResponseEntity.noContent().build();
        }).orElse(ResponseEntity.notFound().build());
    }

    private static String toValue(String label) {
        return label.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "_");
    }
}
