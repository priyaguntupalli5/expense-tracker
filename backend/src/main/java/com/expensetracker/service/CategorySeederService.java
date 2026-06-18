package com.expensetracker.service;

import com.expensetracker.model.GroupCategory;
import com.expensetracker.model.GroupSubcategory;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.GroupCategoryRepository;
import com.expensetracker.repository.GroupRepository;
import com.expensetracker.repository.GroupSubcategoryRepository;
import com.expensetracker.repository.SubcategoryRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CategorySeederService {

    private static final Object[][] DEFAULTS = {
        { "FOOD",          "Food",          "restaurant",     "#e91e63", false },
        { "TRANSPORT",     "Transport",     "directions_car", "#2196f3", false },
        { "HOUSING",       "Housing",       "home",           "#ff9800", false },
        { "ENTERTAINMENT", "Entertainment", "movie",          "#9c27b0", false },
        { "HEALTH",        "Health",        "local_hospital", "#4caf50", false },
        { "SHOPPING",      "Shopping",      "shopping_cart",  "#00bcd4", false },
        { "EDUCATION",     "Education",     "school",         "#ff5722", false },
        { "OTHER",         "Other",         "more_horiz",     "#607d8b", false },
    };

    private final GroupRepository            groupRepo;
    private final GroupCategoryRepository    groupCategoryRepo;
    private final GroupSubcategoryRepository groupSubcategoryRepo;
    private final CategoryRepository         categoryRepo;
    private final SubcategoryRepository      subcategoryRepo;

    public CategorySeederService(GroupRepository groupRepo,
                                 GroupCategoryRepository groupCategoryRepo,
                                 GroupSubcategoryRepository groupSubcategoryRepo,
                                 CategoryRepository categoryRepo,
                                 SubcategoryRepository subcategoryRepo) {
        this.groupRepo            = groupRepo;
        this.groupCategoryRepo    = groupCategoryRepo;
        this.groupSubcategoryRepo = groupSubcategoryRepo;
        this.categoryRepo         = categoryRepo;
        this.subcategoryRepo      = subcategoryRepo;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void migrateExistingGroups() {
        groupRepo.findAll().forEach(g -> seedForGroup(g.getId()));
    }

    @Transactional
    public void seedForGroup(Long groupId) {
        Set<String> existingCats = groupCategoryRepo.findByGroupId(groupId).stream()
                .map(GroupCategory::getValue)
                .collect(Collectors.toSet());

        for (Object[] row : DEFAULTS) {
            String value = (String) row[0];
            if (!existingCats.contains(value)) {
                GroupCategory gc = new GroupCategory();
                gc.setGroupId(groupId);
                gc.setValue(value);
                gc.setLabel((String) row[1]);
                gc.setIcon((String) row[2]);
                gc.setColor((String) row[3]);
                gc.setIsIncome((Boolean) row[4]);
                groupCategoryRepo.save(gc);
                existingCats.add(value);
            }
        }

        categoryRepo.findAll().forEach(c -> {
            if (!existingCats.contains(c.getValue())) {
                GroupCategory gc = new GroupCategory();
                gc.setGroupId(groupId);
                gc.setValue(c.getValue());
                gc.setLabel(c.getLabel());
                gc.setIcon(c.getIcon());
                gc.setColor(c.getColor());
                gc.setIsIncome(c.getIsIncome());
                groupCategoryRepo.save(gc);
                existingCats.add(c.getValue());
            }
        });

        subcategoryRepo.findAll().forEach(s -> {
            String catValue = s.getCategoryValue();
            String name     = s.getName();
            boolean exists  = groupSubcategoryRepo
                    .findByGroupIdAndCategoryValueOrderByNameAsc(groupId, catValue)
                    .stream().anyMatch(gs -> gs.getName().equalsIgnoreCase(name));
            if (!exists) {
                GroupSubcategory gs = new GroupSubcategory();
                gs.setGroupId(groupId);
                gs.setCategoryValue(catValue);
                gs.setName(name);
                groupSubcategoryRepo.save(gs);
            }
        });
    }
}
