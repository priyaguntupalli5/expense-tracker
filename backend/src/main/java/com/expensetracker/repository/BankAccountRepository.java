package com.expensetracker.repository;

import com.expensetracker.model.BankAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BankAccountRepository extends JpaRepository<BankAccount, Long> {
    List<BankAccount> findByGroupId(Long groupId);
    Optional<BankAccount> findByIdAndGroupId(Long id, Long groupId);
    boolean existsByIdAndGroupId(Long id, Long groupId);
    List<BankAccount> findByIdInAndGroupId(List<Long> ids, Long groupId);

    @Query("SELECT DISTINCT t FROM BankAccount a JOIN a.tags t WHERE a.groupId = :groupId")
    List<String> findDistinctTagsByGroupId(@Param("groupId") Long groupId);
}
