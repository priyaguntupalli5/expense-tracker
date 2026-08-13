package com.expensetracker.dto;

import java.math.BigDecimal;

public class SavingsBalanceDTO {
    private Long bankAccountId;
    private BigDecimal tillDate;
    private BigDecimal thisMonth;
    private BigDecimal cashTillDate;
    private BigDecimal investmentTillDate;
    private BigDecimal cashThisMonth;
    private BigDecimal investmentThisMonth;

    public SavingsBalanceDTO() {}

    public SavingsBalanceDTO(Long bankAccountId, BigDecimal tillDate, BigDecimal thisMonth,
                              BigDecimal cashTillDate, BigDecimal investmentTillDate,
                              BigDecimal cashThisMonth, BigDecimal investmentThisMonth) {
        this.bankAccountId = bankAccountId;
        this.tillDate = tillDate;
        this.thisMonth = thisMonth;
        this.cashTillDate = cashTillDate;
        this.investmentTillDate = investmentTillDate;
        this.cashThisMonth = cashThisMonth;
        this.investmentThisMonth = investmentThisMonth;
    }

    public Long getBankAccountId() { return bankAccountId; }
    public void setBankAccountId(Long bankAccountId) { this.bankAccountId = bankAccountId; }

    public BigDecimal getTillDate() { return tillDate; }
    public void setTillDate(BigDecimal tillDate) { this.tillDate = tillDate; }

    public BigDecimal getThisMonth() { return thisMonth; }
    public void setThisMonth(BigDecimal thisMonth) { this.thisMonth = thisMonth; }

    public BigDecimal getCashTillDate() { return cashTillDate; }
    public void setCashTillDate(BigDecimal cashTillDate) { this.cashTillDate = cashTillDate; }

    public BigDecimal getInvestmentTillDate() { return investmentTillDate; }
    public void setInvestmentTillDate(BigDecimal investmentTillDate) { this.investmentTillDate = investmentTillDate; }

    public BigDecimal getCashThisMonth() { return cashThisMonth; }
    public void setCashThisMonth(BigDecimal cashThisMonth) { this.cashThisMonth = cashThisMonth; }

    public BigDecimal getInvestmentThisMonth() { return investmentThisMonth; }
    public void setInvestmentThisMonth(BigDecimal investmentThisMonth) { this.investmentThisMonth = investmentThisMonth; }
}
