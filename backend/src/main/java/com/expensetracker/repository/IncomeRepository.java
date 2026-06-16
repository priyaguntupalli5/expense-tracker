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

    // Templates (recurring definitions — not period-filtered)
    List<Income> findByGroupIdAndIsTemplateTrue(Long groupId);

    // Actual entries for a date range
    List<Income> findByGroupIdAndIsTemplateFalseAndPaymentDateBetweenOrderByPaymentDateDesc(
            Long groupId, LocalDate start, LocalDate end);

    // All non-template entries (no period filter)
    List<Income> findByGroupIdAndIsTemplateFalseOrderByPaymentDateDesc(Long groupId);

    Optional<Income> findByIdAndGroupId(Long id, Long groupId);

    boolean existsByIdAndGroupId(Long id, Long groupId);

    // Duplicate-guard for auto-generation
    boolean existsByTemplateIdAndPaymentDate(Long templateId, LocalDate paymentDate);

    // Manual (non-recurring) entries in a date range — used for dashboard totals
    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM Income i " +
           "WHERE i.groupId = :groupId AND i.isTemplate = false AND i.templateId IS NULL " +
           "AND i.paymentDate BETWEEN :start AND :end")
    BigDecimal sumManualByGroupIdAndDateRange(@Param("groupId") Long groupId,
                                              @Param("start") LocalDate start,
                                              @Param("end") LocalDate end);
}
