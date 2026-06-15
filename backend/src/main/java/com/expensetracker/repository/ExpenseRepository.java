package com.expensetracker.repository;

import com.expensetracker.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    List<Expense> findByGroupIdAndDateBetweenOrderByDateDesc(Long groupId, LocalDate start, LocalDate end);
    List<Expense> findByGroupIdOrderByDateDesc(Long groupId);
    Optional<Expense> findByIdAndGroupId(Long id, Long groupId);
    boolean existsByIdAndGroupId(Long id, Long groupId);
    long countByCategory(String category);
}
