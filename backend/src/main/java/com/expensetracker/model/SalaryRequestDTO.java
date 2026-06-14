package com.expensetracker.model;

import java.math.BigDecimal;

public record SalaryRequestDTO(
    int month,
    int year,
    BigDecimal priyaSalary,
    BigDecimal vamsiSalary
) {}
