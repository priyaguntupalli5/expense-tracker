package com.expensetracker.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public class TransferRequestDTO {
    @NotNull
    private Long fromAccountId;

    @NotNull
    private Long toAccountId;

    @NotNull
    @DecimalMin(value = "0.01")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal amount;

    @NotNull
    @Min(1)
    @Max(12)
    private Integer month;

    @NotNull
    private Integer year;

    @Size(max = 255)
    private String note;

    public Long getFromAccountId() { return fromAccountId; }
    public void setFromAccountId(Long fromAccountId) { this.fromAccountId = fromAccountId; }

    public Long getToAccountId() { return toAccountId; }
    public void setToAccountId(Long toAccountId) { this.toAccountId = toAccountId; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public Integer getMonth() { return month; }
    public void setMonth(Integer month) { this.month = month; }

    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
