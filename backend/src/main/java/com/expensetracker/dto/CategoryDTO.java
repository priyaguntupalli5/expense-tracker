package com.expensetracker.dto;

public class CategoryDTO {

    private Long id;
    private String value;
    private String label;
    private String icon;
    private String color;
    private boolean isIncome;
    private boolean isShared;

    public CategoryDTO(Long id, String value, String label, String icon, String color,
                       boolean isIncome, boolean isShared) {
        this.id       = id;
        this.value    = value;
        this.label    = label;
        this.icon     = icon;
        this.color    = color;
        this.isIncome = isIncome;
        this.isShared = isShared;
    }

    public Long getId()           { return id; }
    public String getValue()      { return value; }
    public String getLabel()      { return label; }
    public String getIcon()       { return icon; }
    public String getColor()      { return color; }
    public boolean getIsIncome()  { return isIncome; }
    public boolean getIsShared()  { return isShared; }
}
