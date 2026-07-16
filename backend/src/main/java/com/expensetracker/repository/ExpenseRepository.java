package com.expensetracker.repository;

import com.expensetracker.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    // Manually-entered expenses only (sourceFixedId IS NULL)
    List<Expense> findByGroupIdAndDateBetweenAndSourceFixedIdIsNullOrderByDateDesc(Long groupId, LocalDate start, LocalDate end);
    List<Expense> findByGroupIdAndSourceFixedIdIsNullOrderByDateDesc(Long groupId);

    // Auto-generated fixed-expense entries (sourceFixedId IS NOT NULL)
    List<Expense> findByGroupIdAndSourceFixedIdIsNotNullAndDateBetweenOrderByDateDesc(Long groupId, LocalDate start, LocalDate end);

    Optional<Expense> findByIdAndGroupId(Long id, Long groupId);
    boolean existsByIdAndGroupId(Long id, Long groupId);

    // Duplicate-guard for auto-generation
    boolean existsBySourceFixedIdAndDate(Long sourceFixedId, LocalDate date);

    long countByCategory(String category);
    long countByCategoryAndGroupId(String category, Long groupId);

    List<Expense> findByIdInAndGroupId(List<Long> ids, Long groupId);

    @Query("SELECT DISTINCT t FROM Expense e JOIN e.tags t WHERE e.groupId = :groupId")
    List<String> findDistinctTagsByGroupId(@Param("groupId") Long groupId);
}
