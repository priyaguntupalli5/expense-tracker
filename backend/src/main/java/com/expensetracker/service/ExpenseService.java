package com.expensetracker.service;

import com.expensetracker.model.Expense;
import com.expensetracker.model.SummaryDTO;
import com.expensetracker.repository.ExpenseRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ExpenseService {

    private final ExpenseRepository repository;

    public ExpenseService(ExpenseRepository repository) {
        this.repository = repository;
    }

    public List<Expense> getAll(Integer month, Integer year, LocalDate startDate, LocalDate endDate) {
        if (startDate != null && endDate != null) {
            return repository.findByDateBetweenOrderByDateDesc(startDate, endDate);
        }
        if (month != null && year != null) {
            LocalDate start = LocalDate.of(year, month, 1);
            LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
            return repository.findByDateBetweenOrderByDateDesc(start, end);
        }
        return repository.findAllByOrderByDateDesc();
    }

    public Optional<Expense> getById(Long id) {
        return repository.findById(id);
    }

    public Expense create(Expense expense) {
        return repository.save(expense);
    }

    public Optional<Expense> update(Long id, Expense updated) {
        return repository.findById(id).map(existing -> {
            existing.setTitle(updated.getTitle());
            existing.setAmount(updated.getAmount());
            existing.setCategory(updated.getCategory());
            existing.setDate(updated.getDate());
            existing.setNotes(updated.getNotes());
            return repository.save(existing);
        });
    }

    public boolean delete(Long id) {
        if (!repository.existsById(id)) return false;
        repository.deleteById(id);
        return true;
    }

    public SummaryDTO getSummary(Integer month, Integer year) {
        List<Expense> expenses = getAll(month, year, null, null);
        BigDecimal total = expenses.stream()
            .map(Expense::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, BigDecimal> breakdown = expenses.stream()
            .collect(Collectors.groupingBy(
                Expense::getCategory,
                Collectors.reducing(BigDecimal.ZERO, Expense::getAmount, BigDecimal::add)
            ));

        return new SummaryDTO(total, expenses.size(), breakdown);
    }
}
