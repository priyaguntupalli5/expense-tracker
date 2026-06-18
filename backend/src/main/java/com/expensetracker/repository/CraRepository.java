package com.expensetracker.repository;

import com.expensetracker.model.CraEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CraRepository extends JpaRepository<CraEntry, Long> {
    List<CraEntry> findByGroupIdOrderByTaxYearDescPersonAscSlipTypeAsc(Long groupId);
    List<CraEntry> findByGroupIdAndTaxYearOrderByPersonAscSlipTypeAsc(Long groupId, int taxYear);
    Optional<CraEntry> findByIdAndGroupId(Long id, Long groupId);
}
