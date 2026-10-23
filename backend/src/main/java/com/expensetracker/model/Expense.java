package com.expensetracker.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "expenses")
@JsonIgnoreProperties(value = "hasImage", allowGetters = true) // output-only, ignored if echoed back
public class Expense {

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

    @NotNull
    private LocalDate date;

    @Size(max = 255)
    private String notes;

    @Size(max = 100)
    private String subcategory;

    // Accepted on create/update but never serialized: receipts are ~100–250 KB each, and
    // returning them in lists blows past Lambda's 6 MB response cap. Clients read hasImage
    // and fetch the image itself from GET /api/expenses/{id}/image.
    @Column(name = "image_data", columnDefinition = "MEDIUMTEXT")
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String imageData;

    @Column(name = "group_id")
    private Long groupId;

    @Column(name = "source_fixed_id")
    private Long sourceFixedId;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "expense_tags", joinColumns = @JoinColumn(name = "expense_id"))
    @Column(name = "tag", length = 50)
    private Set<String> tags = new LinkedHashSet<>();

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public Expense() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getSubcategory() { return subcategory; }
    public void setSubcategory(String subcategory) { this.subcategory = subcategory; }

    public String getImageData() { return imageData; }
    public void setImageData(String imageData) { this.imageData = imageData; }

    @JsonProperty("hasImage")
    public boolean hasImage() { return imageData != null && !imageData.isEmpty(); }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public Long getSourceFixedId() { return sourceFixedId; }
    public void setSourceFixedId(Long sourceFixedId) { this.sourceFixedId = sourceFixedId; }

    public Set<String> getTags() { return tags; }
    public void setTags(Set<String> tags) { this.tags = tags != null ? tags : new LinkedHashSet<>(); }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
