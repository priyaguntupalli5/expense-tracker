package com.expensetracker.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "fixed_expenses")
public class FixedExpense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 100)
    private String title;

    @NotNull
    @DecimalMin(value = "0.01")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal amount;

    @NotBlank
    private String category;

    @Size(max = 255)
    private String notes;

    @Size(max = 100)
    private String subcategory;

    @Column(name = "group_id")
    private Long groupId;

    @Column(nullable = false)
    private String recurrence = "MONTHLY";

    @Column(name = "start_date")
    private LocalDate startDate;

    public FixedExpense() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getSubcategory() { return subcategory; }
    public void setSubcategory(String subcategory) { this.subcategory = subcategory; }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public String getRecurrence() { return recurrence; }
    public void setRecurrence(String recurrence) { this.recurrence = recurrence != null ? recurrence : "MONTHLY"; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
}
