package com.expensetracker.model;

import jakarta.persistence.*;

@Entity
@Table(name = "group_subcategories")
public class GroupSubcategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    @Column(name = "category_value", nullable = false)
    private String categoryValue;

    @Column(nullable = false)
    private String name;

    public GroupSubcategory() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public String getCategoryValue() { return categoryValue; }
    public void setCategoryValue(String categoryValue) { this.categoryValue = categoryValue; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
