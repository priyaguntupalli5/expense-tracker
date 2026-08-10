package com.expensetracker.repository;

import com.expensetracker.model.BankAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BankAccountRepository extends JpaRepository<BankAccount, Long> {
    List<BankAccount> findByGroupId(Long groupId);
    Optional<BankAccount> findByIdAndGroupId(Long id, Long groupId);
    boolean existsByIdAndGroupId(Long id, Long groupId);
}
