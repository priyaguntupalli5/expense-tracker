package com.expensetracker.service;

import com.expensetracker.model.GroupCategory;
import com.expensetracker.model.GroupSubcategory;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.GroupCategoryRepository;
import com.expensetracker.repository.GroupRepository;
import com.expensetracker.repository.GroupSubcategoryRepository;
import com.expensetracker.repository.DefaultSubcategoryRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class CategorySeederService {

    private final GroupRepository            groupRepo;
    private final GroupCategoryRepository    groupCategoryRepo;
    private final GroupSubcategoryRepository groupSubcategoryRepo;
    private final CategoryRepository         categoryRepo;
    private final DefaultSubcategoryRepository subCategoryRepo;

    public CategorySeederService(GroupRepository groupRepo,
                                 GroupCategoryRepository groupCategoryRepo,
                                 GroupSubcategoryRepository groupSubcategoryRepo,
                                 CategoryRepository categoryRepo,
                                 DefaultSubcategoryRepository subCategoryRepo) {
        this.groupRepo            = groupRepo;
        this.groupCategoryRepo    = groupCategoryRepo;
        this.groupSubcategoryRepo = groupSubcategoryRepo;
        this.categoryRepo         = categoryRepo;
        this.subCategoryRepo      = subCategoryRepo;
    }

    // Skipped on Lambda (new groups are seeded at registration instead). The check sits in the
    // listener condition, not the method body, because @Transactional opens a DB connection on entry.
    @EventListener(value = ApplicationReadyEvent.class,
                   condition = "@environment.getProperty('app.startup-jobs.enabled', 'true') == 'true'")
    @Transactional
    public void migrateExistingGroups() {
        groupRepo.findAll().forEach(g -> {
            if (groupCategoryRepo.findByGroupId(g.getId()).isEmpty()) {
                seedForGroup(g.getId());
            }
        });
    }

    @Transactional
    public void seedForGroup(Long groupId) {
        seedCategories(groupId);
        seedSubcategories(groupId);
    }

    private void seedCategories(Long groupId) {
        Set<String> existing = groupCategoryRepo.findByGroupId(groupId).stream()
                .map(GroupCategory::getValue)
                .collect(Collectors.toSet());

        categoryRepo.findAll().forEach(c -> {
            if (!existing.contains(c.getValue())) {
                GroupCategory gc = new GroupCategory();
                gc.setGroupId(groupId);
                gc.setValue(c.getValue());
                gc.setLabel(c.getLabel());
                gc.setIcon(c.getIcon());
                gc.setColor(c.getColor());
                gc.setIsIncome(c.getIsIncome());
                groupCategoryRepo.save(gc);
            }
        });
    }

    private void seedSubcategories(Long groupId) {
        // Load all existing group subcategory names per category into a cache
        Map<String, Set<String>> existing = new HashMap<>();
        groupSubcategoryRepo.findByGroupId(groupId).forEach(gs ->
            existing.computeIfAbsent(gs.getCategoryValue(), k -> new HashSet<>())
                    .add(gs.getName().toLowerCase())
        );

        subCategoryRepo.findAll().forEach(s -> {
            Set<String> existingNames = existing.computeIfAbsent(s.getCategoryValue(), k -> new HashSet<>());
            if (!existingNames.contains(s.getName().toLowerCase())) {
                GroupSubcategory gs = new GroupSubcategory();
                gs.setGroupId(groupId);
                gs.setCategoryValue(s.getCategoryValue());
                gs.setName(s.getName());
                groupSubcategoryRepo.save(gs);
                existingNames.add(s.getName().toLowerCase());
            }
        });
    }
}
