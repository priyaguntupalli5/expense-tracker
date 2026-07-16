package com.expensetracker.dto;

import java.util.List;

public class BulkTagRequest {
    private List<Long> ids;
    private String tag;

    public List<Long> getIds() { return ids; }
    public void setIds(List<Long> ids) { this.ids = ids; }
    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }
}
