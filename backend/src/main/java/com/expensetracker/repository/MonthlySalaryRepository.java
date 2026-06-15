package com.expensetracker.repository;

import com.expensetracker.model.MonthlySalary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MonthlySalaryRepository extends JpaRepository<MonthlySalary, Long> {
    Optional<MonthlySalary> findByGroupIdAndMonthAndYear(Long groupId, int month, int year);
}
