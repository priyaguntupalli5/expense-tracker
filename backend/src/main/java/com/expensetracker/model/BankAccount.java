package com.expensetracker.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "bank_accounts")
public class BankAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 50)
    @Column(name = "owner_name")
    private String ownerName;

    @NotBlank
    @Size(max = 100)
    @Column(name = "account_name")
    private String accountName;

    @Column(name = "group_id")
    private Long groupId;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public BankAccount() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

    public String getAccountName() { return accountName; }
    public void setAccountName(String accountName) { this.accountName = accountName; }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
