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

    public List<Expense> getAll(Long groupId, Integer month, Integer year, LocalDate startDate, LocalDate endDate) {
        if (startDate != null && endDate != null) {
            return repository.findByGroupIdAndDateBetweenAndSourceFixedIdIsNullOrderByDateDesc(groupId, startDate, endDate);
        }
        if (month != null && year != null) {
            LocalDate start = LocalDate.of(year, month, 1);
            LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
            return repository.findByGroupIdAndDateBetweenAndSourceFixedIdIsNullOrderByDateDesc(groupId, start, end);
        }
        return repository.findByGroupIdAndSourceFixedIdIsNullOrderByDateDesc(groupId);
    }

    public List<Expense> getFixedEntries(Long groupId, int month, int year) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end   = start.withDayOfMonth(start.lengthOfMonth());
        return repository.findByGroupIdAndSourceFixedIdIsNotNullAndDateBetweenOrderByDateDesc(groupId, start, end);
    }

    public Optional<Expense> getById(Long id, Long groupId) {
        return repository.findByIdAndGroupId(id, groupId);
    }

    public Expense create(Expense expense, Long groupId) {
        expense.setGroupId(groupId);
        return repository.save(expense);
    }

    public Optional<Expense> update(Long id, Long groupId, Expense updated) {
        return repository.findByIdAndGroupId(id, groupId).map(existing -> {
            existing.setTitle(updated.getTitle());
            existing.setAmount(updated.getAmount());
            existing.setCategory(updated.getCategory());
            existing.setDate(updated.getDate());
            existing.setNotes(updated.getNotes());
            existing.setSubcategory(updated.getSubcategory());
            existing.setImageData(updated.getImageData());
            return repository.save(existing);
        });
    }

    public boolean delete(Long id, Long groupId) {
        if (!repository.existsByIdAndGroupId(id, groupId)) return false;
        repository.deleteById(id);
        return true;
    }

    public SummaryDTO getSummary(Long groupId, Integer month, Integer year, LocalDate toDate) {
        // Exclude auto-generated expenses (sourceFixedId != null) — they are already
        // counted in the Fixed Expenses total on the dashboard to avoid double-counting.
        List<Expense> expenses;
        if (month != null && year != null) {
            LocalDate start = LocalDate.of(year, month, 1);
            LocalDate end   = (toDate != null) ? toDate : start.withDayOfMonth(start.lengthOfMonth());
            expenses = repository.findByGroupIdAndDateBetweenAndSourceFixedIdIsNullOrderByDateDesc(groupId, start, end);
        } else {
            expenses = repository.findByGroupIdAndSourceFixedIdIsNullOrderByDateDesc(groupId);
        }

        BigDecimal total = expenses.stream()
            .map(Expense::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, BigDecimal> breakdown = expenses.stream()
            .collect(Collectors.groupingBy(
                Expense::getCategory,
                Collectors.reducing(BigDecimal.ZERO, Expense::getAmount, BigDecimal::add)
            ));

        Map<String, Map<String, BigDecimal>> subcategoryBreakdown = expenses.stream()
            .collect(Collectors.groupingBy(
                Expense::getCategory,
                Collectors.groupingBy(
                    e -> (e.getSubcategory() != null && !e.getSubcategory().isBlank())
                         ? e.getSubcategory() : "General",
                    Collectors.reducing(BigDecimal.ZERO, Expense::getAmount, BigDecimal::add)
                )
            ));

        Map<String, Map<String, BigDecimal>> titleBreakdown = expenses.stream()
            .collect(Collectors.groupingBy(
                Expense::getCategory,
                Collectors.groupingBy(
                    Expense::getTitle,
                    Collectors.reducing(BigDecimal.ZERO, Expense::getAmount, BigDecimal::add)
                )
            ));

        return new SummaryDTO(total, expenses.size(), breakdown, subcategoryBreakdown, titleBreakdown);
    }
}
