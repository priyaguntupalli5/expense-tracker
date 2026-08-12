package com.expensetracker.dto;

import java.math.BigDecimal;

public class SavingsBalanceDTO {
    private Long bankAccountId;
    private BigDecimal tillDate;
    private BigDecimal thisMonth;

    public SavingsBalanceDTO() {}

    public SavingsBalanceDTO(Long bankAccountId, BigDecimal tillDate, BigDecimal thisMonth) {
        this.bankAccountId = bankAccountId;
        this.tillDate = tillDate;
        this.thisMonth = thisMonth;
    }

    public Long getBankAccountId() { return bankAccountId; }
    public void setBankAccountId(Long bankAccountId) { this.bankAccountId = bankAccountId; }

    public BigDecimal getTillDate() { return tillDate; }
    public void setTillDate(BigDecimal tillDate) { this.tillDate = tillDate; }

    public BigDecimal getThisMonth() { return thisMonth; }
    public void setThisMonth(BigDecimal thisMonth) { this.thisMonth = thisMonth; }
}
