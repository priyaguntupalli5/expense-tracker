package com.expensetracker.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(
    name = "monthly_salaries",
    uniqueConstraints = @UniqueConstraint(columnNames = {"group_id", "month", "year"})
)
public class MonthlySalary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private int month;

    @Column(nullable = false)
    private int year;

    @Column(name = "priya_salary", precision = 12, scale = 2, nullable = false)
    private BigDecimal priyaSalary = BigDecimal.ZERO;

    @Column(name = "vamsi_salary", precision = 12, scale = 2, nullable = false)
    private BigDecimal vamsiSalary = BigDecimal.ZERO;

    @Column(name = "group_id")
    private Long groupId;

    public MonthlySalary() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public int getMonth() { return month; }
    public void setMonth(int month) { this.month = month; }

    public int getYear() { return year; }
    public void setYear(int year) { this.year = year; }

    public BigDecimal getPriyaSalary() { return priyaSalary; }
    public void setPriyaSalary(BigDecimal priyaSalary) { this.priyaSalary = priyaSalary; }

    public BigDecimal getVamsiSalary() { return vamsiSalary; }
    public void setVamsiSalary(BigDecimal vamsiSalary) { this.vamsiSalary = vamsiSalary; }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }
}
