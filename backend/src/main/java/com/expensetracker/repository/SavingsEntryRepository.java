package com.expensetracker.repository;

import com.expensetracker.model.SavingsEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SavingsEntryRepository extends JpaRepository<SavingsEntry, Long> {
    List<SavingsEntry> findByGroupIdAndMonthAndYear(Long groupId, Integer month, Integer year);
    Optional<SavingsEntry> findByBankAccountIdAndMonthAndYear(Long bankAccountId, Integer month, Integer year);
    boolean existsByIdAndGroupId(Long id, Long groupId);
}
