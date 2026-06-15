package com.expensetracker.controller;

import com.expensetracker.model.Subcategory;
import com.expensetracker.repository.SubcategoryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/subcategories")
public class SubcategoryController {

    private final SubcategoryRepository subcategoryRepo;

    public SubcategoryController(SubcategoryRepository subcategoryRepo) {
        this.subcategoryRepo = subcategoryRepo;
    }

    @GetMapping
    public List<Subcategory> getByCategory(@RequestParam String category) {
        return subcategoryRepo.findByCategoryValueOrderByNameAsc(category);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Subcategory body) {
        String name = body.getName() == null ? "" : body.getName().trim();
        if (name.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name is required."));
        }
        if (name.length() > 100) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name must be 100 characters or fewer."));
        }
        boolean exists = subcategoryRepo
            .findByCategoryValueOrderByNameAsc(body.getCategoryValue())
            .stream().anyMatch(s -> s.getName().equalsIgnoreCase(name));
        if (exists) {
            return ResponseEntity.badRequest().body(Map.of("error", "\"" + name + "\" already exists in this category."));
        }
        Subcategory s = new Subcategory();
        s.setCategoryValue(body.getCategoryValue());
        s.setName(name);
        return ResponseEntity.ok(subcategoryRepo.save(s));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        subcategoryRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
