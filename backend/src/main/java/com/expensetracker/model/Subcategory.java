package com.expensetracker.model;

import jakarta.persistence.*;

@Entity
@Table(name = "subcategories")
public class Subcategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "category_value", nullable = false)
    private String categoryValue;

    @Column(nullable = false)
    private String name;

    public Subcategory() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCategoryValue() { return categoryValue; }
    public void setCategoryValue(String categoryValue) { this.categoryValue = categoryValue; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
