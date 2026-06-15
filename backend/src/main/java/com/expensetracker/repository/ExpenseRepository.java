package com.expensetracker.repository;

import com.expensetracker.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    // For expense list (shows everything)
    List<Expense> findByGroupIdAndDateBetweenOrderByDateDesc(Long groupId, LocalDate start, LocalDate end);
    List<Expense> findByGroupIdOrderByDateDesc(Long groupId);

    // For dashboard summary (exclude auto-generated; already in Fixed Total)
    List<Expense> findByGroupIdAndDateBetweenAndSourceFixedIdIsNullOrderByDateDesc(Long groupId, LocalDate start, LocalDate end);

    Optional<Expense> findByIdAndGroupId(Long id, Long groupId);
    boolean existsByIdAndGroupId(Long id, Long groupId);

    // Duplicate-guard for auto-generation
    boolean existsBySourceFixedIdAndDate(Long sourceFixedId, LocalDate date);

    long countByCategory(String category);
}
