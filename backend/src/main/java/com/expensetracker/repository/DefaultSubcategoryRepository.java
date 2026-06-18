package com.expensetracker.repository;

import com.expensetracker.model.SubCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DefaultSubcategoryRepository extends JpaRepository<SubCategory, Long> {
}
