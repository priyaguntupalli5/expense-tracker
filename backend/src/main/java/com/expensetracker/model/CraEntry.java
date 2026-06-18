package com.expensetracker.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "cra_entries")
public class CraEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tax_year", nullable = false)
    private int taxYear;

    @Column(nullable = false, length = 100)
    private String person;

    @Column(name = "slip_type", nullable = false, length = 20)
    private String slipType;

    @Column(nullable = false, length = 150)
    private String issuer;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "tax_deducted", precision = 12, scale = 2)
    private BigDecimal taxDeducted;

    @Column(length = 500)
    private String notes;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    public CraEntry() {}

    public Long getId()                  { return id; }
    public void setId(Long id)           { this.id = id; }

    public int getTaxYear()              { return taxYear; }
    public void setTaxYear(int taxYear)  { this.taxYear = taxYear; }

    public String getPerson()              { return person; }
    public void setPerson(String person)   { this.person = person; }

    public String getSlipType()              { return slipType; }
    public void setSlipType(String slipType) { this.slipType = slipType; }

    public String getIssuer()              { return issuer; }
    public void setIssuer(String issuer)   { this.issuer = issuer; }

    public BigDecimal getAmount()              { return amount; }
    public void setAmount(BigDecimal amount)   { this.amount = amount; }

    public BigDecimal getTaxDeducted()                   { return taxDeducted; }
    public void setTaxDeducted(BigDecimal taxDeducted)   { this.taxDeducted = taxDeducted; }

    public String getNotes()             { return notes; }
    public void setNotes(String notes)   { this.notes = notes; }

    public Long getGroupId()               { return groupId; }
    public void setGroupId(Long groupId)   { this.groupId = groupId; }
}
