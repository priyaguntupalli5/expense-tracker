package com.expensetracker.dto;

public class SubcategoryDTO {

    private Long id;
    private String categoryValue;
    private String name;
    private boolean isShared;

    public SubcategoryDTO(Long id, String categoryValue, String name, boolean isShared) {
        this.id            = id;
        this.categoryValue = categoryValue;
        this.name          = name;
        this.isShared      = isShared;
    }

    public Long getId()               { return id; }
    public String getCategoryValue()  { return categoryValue; }
    public String getName()           { return name; }
    public boolean getIsShared()      { return isShared; }
}
