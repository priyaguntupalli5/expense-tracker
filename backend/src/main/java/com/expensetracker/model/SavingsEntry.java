package com.expensetracker.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "savings_entries")
public class SavingsEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "bank_account_id")
    private Long bankAccountId;

    @Column(name = "group_id")
    private Long groupId;

    @NotNull
    @Min(1)
    @Max(12)
    private Integer month;

    @NotNull
    private Integer year;

    @NotNull
    @Digits(integer = 10, fraction = 2)
    private BigDecimal amount;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public SavingsEntry() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getBankAccountId() { return bankAccountId; }
    public void setBankAccountId(Long bankAccountId) { this.bankAccountId = bankAccountId; }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public Integer getMonth() { return month; }
    public void setMonth(Integer month) { this.month = month; }

    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
