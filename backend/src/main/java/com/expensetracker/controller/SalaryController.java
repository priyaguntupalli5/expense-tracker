package com.expensetracker.controller;

import com.expensetracker.model.MonthlySalary;
import com.expensetracker.model.SalaryRequestDTO;
import com.expensetracker.model.User;
import com.expensetracker.repository.MonthlySalaryRepository;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/salaries")
public class SalaryController {

    private final MonthlySalaryRepository repository;

    public SalaryController(MonthlySalaryRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public MonthlySalary getSalary(@AuthenticationPrincipal User user,
                                   @RequestParam int month,
                                   @RequestParam int year) {
        return repository.findByGroupIdAndMonthAndYear(user.getGroup().getId(), month, year)
            .orElseGet(() -> {
                MonthlySalary empty = new MonthlySalary();
                empty.setMonth(month);
                empty.setYear(year);
                empty.setPriyaSalary(BigDecimal.ZERO);
                empty.setVamsiSalary(BigDecimal.ZERO);
                return empty;
            });
    }

    @PostMapping
    public MonthlySalary saveSalary(@AuthenticationPrincipal User user, @RequestBody SalaryRequestDTO dto) {
        Long groupId = user.getGroup().getId();
        MonthlySalary salary = repository.findByGroupIdAndMonthAndYear(groupId, dto.month(), dto.year())
            .orElseGet(() -> {
                MonthlySalary s = new MonthlySalary();
                s.setGroupId(groupId);
                s.setMonth(dto.month());
                s.setYear(dto.year());
                return s;
            });
        salary.setPriyaSalary(dto.priyaSalary() != null ? dto.priyaSalary() : BigDecimal.ZERO);
        salary.setVamsiSalary(dto.vamsiSalary() != null ? dto.vamsiSalary() : BigDecimal.ZERO);
        return repository.save(salary);
    }
}
