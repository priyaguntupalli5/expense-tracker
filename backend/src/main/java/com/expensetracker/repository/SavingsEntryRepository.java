package com.expensetracker.repository;

import com.expensetracker.model.SavingsEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SavingsEntryRepository extends JpaRepository<SavingsEntry, Long> {
    List<SavingsEntry> findByGroupIdAndMonthAndYear(Long groupId, Integer month, Integer year);
    Optional<SavingsEntry> findByBankAccountIdAndMonthAndYear(Long bankAccountId, Integer month, Integer year);
    boolean existsByIdAndGroupId(Long id, Long groupId);
    Optional<SavingsEntry> findByIdAndGroupId(Long id, Long groupId);

    @Query("SELECT e FROM SavingsEntry e WHERE e.groupId = :groupId " +
           "AND (e.year < :year OR (e.year = :year AND e.month <= :month))")
    List<SavingsEntry> findByGroupIdAndPeriodUpTo(@Param("groupId") Long groupId,
                                                   @Param("year") Integer year,
                                                   @Param("month") Integer month);
}
