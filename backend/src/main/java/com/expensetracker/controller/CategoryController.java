package com.expensetracker.controller;

import com.expensetracker.dto.CategoryDTO;
import com.expensetracker.model.Category;
import com.expensetracker.model.GroupCategory;
import com.expensetracker.model.User;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.ExpenseRepository;
import com.expensetracker.repository.FixedExpenseRepository;
import com.expensetracker.repository.GroupCategoryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryRepository      categoryRepo;
    private final GroupCategoryRepository groupCategoryRepo;
    private final ExpenseRepository       expenseRepo;
    private final FixedExpenseRepository  fixedExpenseRepo;

    public CategoryController(CategoryRepository categoryRepo,
                              GroupCategoryRepository groupCategoryRepo,
                              ExpenseRepository expenseRepo,
                              FixedExpenseRepository fixedExpenseRepo) {
        this.categoryRepo      = categoryRepo;
        this.groupCategoryRepo = groupCategoryRepo;
        this.expenseRepo       = expenseRepo;
        this.fixedExpenseRepo  = fixedExpenseRepo;
    }

    /**
     * Returns shared (default) categories merged with this group's overrides/additions.
     * If the group has customised a shared category (same value), the group version wins.
     */
    @GetMapping
    public List<CategoryDTO> getAll(@AuthenticationPrincipal User user) {
        Long groupId = user.getGroup().getId();

        // Seed with shared categories
        Map<String, CategoryDTO> result = new LinkedHashMap<>();
        for (Category c : categoryRepo.findAll()) {
            result.put(c.getValue(), toDTO(c));
        }

        // Group overrides take precedence over shared ones with the same value
        for (GroupCategory gc : groupCategoryRepo.findByGroupId(groupId)) {
            result.put(gc.getValue(), toDTO(gc));
        }

        return new ArrayList<>(result.values());
    }

    /** Creates a new category scoped to the requesting group. */
    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal User user, @RequestBody Category body) {
        Long groupId = user.getGroup().getId();
        String value = toValue(body.getLabel());

        boolean existsShared = categoryRepo.existsByValue(value);
        boolean existsGroup  = groupCategoryRepo.findByGroupIdAndValue(groupId, value).isPresent();
        if (existsShared || existsGroup) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "A category named \"" + body.getLabel() + "\" already exists."));
        }

        GroupCategory gc = new GroupCategory();
        gc.setGroupId(groupId);
        gc.setValue(value);
        gc.setLabel(body.getLabel().trim());
        gc.setIcon(body.getIcon());
        gc.setColor(body.getColor());
        gc.setIsIncome(body.getIsIncome());
        return ResponseEntity.ok(toDTO(groupCategoryRepo.save(gc)));
    }

    /**
     * Updates a category.
     *
     * ?shared=true  → the id refers to a shared category; creates/updates a group-level
     *                 override so other groups are unaffected.
     * ?shared=false → the id refers to a group-owned category; updates it directly.
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@AuthenticationPrincipal User user,
                                    @PathVariable Long id,
                                    @RequestParam(defaultValue = "false") boolean shared,
                                    @RequestBody Category body) {
        Long groupId = user.getGroup().getId();

        if (shared) {
            Optional<Category> opt = categoryRepo.findById(id);
            if (opt.isEmpty()) return ResponseEntity.notFound().build();
            Category existing = opt.get();

            // Upsert a group override preserving the shared value key
            GroupCategory gc = groupCategoryRepo.findByGroupIdAndValue(groupId, existing.getValue())
                    .orElseGet(() -> {
                        GroupCategory n = new GroupCategory();
                        n.setGroupId(groupId);
                        n.setValue(existing.getValue());
                        n.setIsIncome(existing.getIsIncome());
                        return n;
                    });
            gc.setLabel(body.getLabel().trim());
            gc.setIcon(body.getIcon());
            gc.setColor(body.getColor());
            return ResponseEntity.ok(toDTO(groupCategoryRepo.save(gc)));
        }

        // Group-owned category
        Optional<GroupCategory> opt = groupCategoryRepo.findById(id);
        if (opt.isEmpty() || !opt.get().getGroupId().equals(groupId)) {
            return ResponseEntity.notFound().build();
        }
        GroupCategory gc = opt.get();
        String newValue = toValue(body.getLabel());
        if (groupCategoryRepo.existsByGroupIdAndValueAndIdNot(groupId, newValue, id)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "A category named \"" + body.getLabel() + "\" already exists."));
        }
        gc.setLabel(body.getLabel().trim());
        gc.setIcon(body.getIcon());
        gc.setColor(body.getColor());
        return ResponseEntity.ok(toDTO(groupCategoryRepo.save(gc)));
    }

    /**
     * Deletes a group-owned category. Shared (default) categories cannot be deleted —
     * edit them instead to create a group-level customisation.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@AuthenticationPrincipal User user,
                                    @PathVariable Long id,
                                    @RequestParam(defaultValue = "false") boolean shared) {
        if (shared) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Default categories cannot be deleted. Edit to customise for your group."));
        }

        Long groupId = user.getGroup().getId();
        Optional<GroupCategory> opt = groupCategoryRepo.findById(id);
        if (opt.isEmpty() || !opt.get().getGroupId().equals(groupId)) {
            return ResponseEntity.notFound().build();
        }
        GroupCategory gc = opt.get();
        long inUse = expenseRepo.countByCategoryAndGroupId(gc.getValue(), groupId)
                   + fixedExpenseRepo.countByCategoryAndGroupId(gc.getValue(), groupId);
        if (inUse > 0) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Cannot delete: this category is used by " + inUse + " expense(s)."));
        }
        groupCategoryRepo.delete(gc);
        return ResponseEntity.noContent().build();
    }

    private CategoryDTO toDTO(Category c) {
        return new CategoryDTO(c.getId(), c.getValue(), c.getLabel(), c.getIcon(), c.getColor(),
                               c.getIsIncome(), true);
    }

    private CategoryDTO toDTO(GroupCategory gc) {
        return new CategoryDTO(gc.getId(), gc.getValue(), gc.getLabel(), gc.getIcon(), gc.getColor(),
                               gc.getIsIncome(), false);
    }

    private static String toValue(String label) {
        return label.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "_");
    }
}
