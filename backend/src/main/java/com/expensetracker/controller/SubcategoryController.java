package com.expensetracker.controller;

import com.expensetracker.model.Subcategory;
import com.expensetracker.repository.SubcategoryRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
}
