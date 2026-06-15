package com.expensetracker.repository;

import com.expensetracker.model.Income;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface IncomeRepository extends JpaRepository<Income, Long> {

    // Templates (recurring definitions)
    List<Income> findByGroupIdAndIsTemplateTrue(Long groupId);

    // Actual entries for a period (non-template)
    List<Income> findByGroupIdAndIsTemplateFalseAndMonthAndYearOrderByIdDesc(Long groupId, int month, int year);

    // All non-template entries regardless of period
    List<Income> findByGroupIdAndIsTemplateFalseOrderByYearDescMonthDescIdDesc(Long groupId);

    Optional<Income> findByIdAndGroupId(Long id, Long groupId);

    boolean existsByIdAndGroupId(Long id, Long groupId);

    // Duplicate-guard for auto-generation
    boolean existsByTemplateIdAndPaymentDate(Long templateId, LocalDate paymentDate);

    // Manual (non-recurring) entries only — used for end-of-month projection base
    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM Income i " +
           "WHERE i.groupId = :groupId AND i.month = :month AND i.year = :year " +
           "AND i.isTemplate = false AND i.templateId IS NULL")
    BigDecimal sumManualByGroupIdAndMonthAndYear(@Param("groupId") Long groupId,
                                                 @Param("month") int month,
                                                 @Param("year") int year);

    // To-date total: entries with no paymentDate (manual) always count; auto-generated
    // entries only count if their paymentDate is on or before the cutoff.
    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM Income i " +
           "WHERE i.groupId = :groupId AND i.month = :month AND i.year = :year AND i.isTemplate = false " +
           "AND (i.paymentDate IS NULL OR i.paymentDate <= :toDate)")
    BigDecimal sumByGroupIdAndMonthAndYearToDate(@Param("groupId") Long groupId,
                                                 @Param("month") int month,
                                                 @Param("year") int year,
                                                 @Param("toDate") LocalDate toDate);
}
