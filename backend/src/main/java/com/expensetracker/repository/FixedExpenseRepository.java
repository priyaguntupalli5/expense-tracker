package com.expensetracker.repository;

import com.expensetracker.model.FixedExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FixedExpenseRepository extends JpaRepository<FixedExpense, Long> {
    long countByCategory(String category);
}
