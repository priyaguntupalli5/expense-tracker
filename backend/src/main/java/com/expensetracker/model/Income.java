package com.expensetracker.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "income_entries")
public class Income {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "source_type", nullable = false)
    private String sourceType = "SALARY";

    @Column(nullable = false)
    private int month;

    @Column(nullable = false)
    private int year;

    @Column
    private String notes;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    // ── Recurrence fields ─────────────────────────────────────────────────────
    @Column
    private String recurrence;          // WEEKLY | BIWEEKLY | MONTHLY | QUARTERLY | YEARLY

    @Column(name = "payment_day")
    private Integer paymentDay;         // day-of-week (1–7) or day-of-month (1–31)

    @Column(name = "payment_month")
    private Integer paymentMonth;       // 1–12, only for YEARLY

    @Column(name = "start_date")
    private LocalDate startDate;        // first payment date (anchor for recurrence)

    @Column(name = "is_template", nullable = false)
    private boolean isTemplate = false; // true = recurring definition; false = actual entry

    @Column(name = "template_id")
    private Long templateId;            // populated on auto-generated entries

    @Column(name = "payment_date")
    private LocalDate paymentDate;      // exact date the auto-generated entry represents

    public Income() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }

    public int getMonth() { return month; }
    public void setMonth(int month) { this.month = month; }

    public int getYear() { return year; }
    public void setYear(int year) { this.year = year; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public String getRecurrence() { return recurrence; }
    public void setRecurrence(String recurrence) { this.recurrence = recurrence; }

    public Integer getPaymentDay() { return paymentDay; }
    public void setPaymentDay(Integer paymentDay) { this.paymentDay = paymentDay; }

    public Integer getPaymentMonth() { return paymentMonth; }
    public void setPaymentMonth(Integer paymentMonth) { this.paymentMonth = paymentMonth; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    @JsonProperty("isTemplate")
    public boolean isTemplate() { return isTemplate; }

    @JsonProperty("isTemplate")
    public void setTemplate(boolean isTemplate) { this.isTemplate = isTemplate; }

    public Long getTemplateId() { return templateId; }
    public void setTemplateId(Long templateId) { this.templateId = templateId; }

    public LocalDate getPaymentDate() { return paymentDate; }
    public void setPaymentDate(LocalDate paymentDate) { this.paymentDate = paymentDate; }
}
