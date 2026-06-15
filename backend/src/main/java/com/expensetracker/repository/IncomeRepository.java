package com.expensetracker.repository;

import com.expensetracker.model.Income;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface IncomeRepository extends JpaRepository<Income, Long> {

    List<Income> findByGroupIdAndMonthAndYearOrderByIdDesc(Long groupId, int month, int year);

    List<Income> findByGroupIdOrderByYearDescMonthDescIdDesc(Long groupId);

    Optional<Income> findByIdAndGroupId(Long id, Long groupId);

    boolean existsByIdAndGroupId(Long id, Long groupId);

    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM Income i WHERE i.groupId = :groupId AND i.month = :month AND i.year = :year")
    BigDecimal sumByGroupIdAndMonthAndYear(@Param("groupId") Long groupId, @Param("month") int month, @Param("year") int year);
}
