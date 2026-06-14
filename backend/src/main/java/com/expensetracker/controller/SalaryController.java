package com.expensetracker.controller;

import com.expensetracker.model.MonthlySalary;
import com.expensetracker.model.SalaryRequestDTO;
import com.expensetracker.repository.MonthlySalaryRepository;
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
    public MonthlySalary getSalary(@RequestParam int month, @RequestParam int year) {
        return repository.findByMonthAndYear(month, year).orElseGet(() -> {
            MonthlySalary empty = new MonthlySalary();
            empty.setMonth(month);
            empty.setYear(year);
            empty.setPriyaSalary(BigDecimal.ZERO);
            empty.setVamsiSalary(BigDecimal.ZERO);
            return empty;
        });
    }

    @PostMapping
    public MonthlySalary saveSalary(@RequestBody SalaryRequestDTO dto) {
        MonthlySalary salary = repository.findByMonthAndYear(dto.month(), dto.year())
            .orElseGet(() -> {
                MonthlySalary s = new MonthlySalary();
                s.setMonth(dto.month());
                s.setYear(dto.year());
                return s;
            });
        salary.setPriyaSalary(dto.priyaSalary() != null ? dto.priyaSalary() : BigDecimal.ZERO);
        salary.setVamsiSalary(dto.vamsiSalary() != null ? dto.vamsiSalary() : BigDecimal.ZERO);
        return repository.save(salary);
    }
}
