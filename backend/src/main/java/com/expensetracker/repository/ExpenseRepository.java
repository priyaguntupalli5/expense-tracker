package com.expensetracker.repository;

import com.expensetracker.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

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

    @Modifying
    @Transactional
    @Query("UPDATE Expense e SET e.tag = :tag WHERE e.id IN :ids AND e.groupId = :groupId")
    int bulkUpdateTag(@Param("ids") List<Long> ids, @Param("tag") String tag, @Param("groupId") Long groupId);

    @Query("SELECT DISTINCT e.tag FROM Expense e WHERE e.groupId = :groupId AND e.tag IS NOT NULL AND e.tag <> ''")
    List<String> findDistinctTagsByGroupId(@Param("groupId") Long groupId);
}
