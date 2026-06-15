package com.expensetracker.controller;

import com.expensetracker.model.Income;
import com.expensetracker.model.User;
import com.expensetracker.repository.IncomeRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/income")
public class IncomeController {

    private final IncomeRepository repository;

    public IncomeController(IncomeRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<Income> getAll(@AuthenticationPrincipal User user,
                               @RequestParam(required = false) Integer month,
                               @RequestParam(required = false) Integer year) {
        Long groupId = user.getGroup().getId();
        if (month != null && year != null) {
            return repository.findByGroupIdAndMonthAndYearOrderByIdDesc(groupId, month, year);
        }
        return repository.findByGroupIdOrderByYearDescMonthDescIdDesc(groupId);
    }

    @GetMapping("/total")
    public Map<String, BigDecimal> getTotal(@AuthenticationPrincipal User user,
                                            @RequestParam int month,
                                            @RequestParam int year) {
        BigDecimal total = repository.sumByGroupIdAndMonthAndYear(user.getGroup().getId(), month, year);
        return Map.of("total", total);
    }

    @PostMapping
    public Income create(@AuthenticationPrincipal User user, @RequestBody Income income) {
        income.setGroupId(user.getGroup().getId());
        return repository.save(income);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Income> update(@AuthenticationPrincipal User user,
                                         @PathVariable Long id,
                                         @RequestBody Income income) {
        return repository.findByIdAndGroupId(id, user.getGroup().getId())
            .map(existing -> {
                existing.setTitle(income.getTitle());
                existing.setAmount(income.getAmount());
                existing.setSourceType(income.getSourceType());
                existing.setMonth(income.getMonth());
                existing.setYear(income.getYear());
                existing.setNotes(income.getNotes());
                return ResponseEntity.ok(repository.save(existing));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        if (!repository.existsByIdAndGroupId(id, user.getGroup().getId())) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
