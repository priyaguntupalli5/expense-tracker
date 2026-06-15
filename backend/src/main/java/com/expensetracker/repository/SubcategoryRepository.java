package com.expensetracker.repository;

import com.expensetracker.model.Subcategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubcategoryRepository extends JpaRepository<Subcategory, Long> {
    List<Subcategory> findByCategoryValueOrderByNameAsc(String categoryValue);
}
