package com.expensetracker.controller;

import com.expensetracker.dto.CategoryDTO;
import com.expensetracker.model.GroupCategory;
import com.expensetracker.model.User;
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

    private final GroupCategoryRepository groupCategoryRepo;
    private final ExpenseRepository       expenseRepo;
    private final FixedExpenseRepository  fixedExpenseRepo;

    public CategoryController(GroupCategoryRepository groupCategoryRepo,
                              ExpenseRepository expenseRepo,
                              FixedExpenseRepository fixedExpenseRepo) {
        this.groupCategoryRepo = groupCategoryRepo;
        this.expenseRepo       = expenseRepo;
        this.fixedExpenseRepo  = fixedExpenseRepo;
    }

    @GetMapping
    public List<CategoryDTO> getAll(@AuthenticationPrincipal User user) {
        Long groupId = user.getGroup().getId();
        return groupCategoryRepo.findByGroupId(groupId).stream()
                .map(this::toDTO)
                .toList();
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal User user,
                                    @RequestBody GroupCategory body) {
        Long groupId = user.getGroup().getId();
        String value = toValue(body.getLabel());

        if (groupCategoryRepo.findByGroupIdAndValue(groupId, value).isPresent()) {
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

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@AuthenticationPrincipal User user,
                                    @PathVariable Long id,
                                    @RequestBody GroupCategory body) {
        Long groupId = user.getGroup().getId();
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

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@AuthenticationPrincipal User user,
                                    @PathVariable Long id) {
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

    private CategoryDTO toDTO(GroupCategory gc) {
        return new CategoryDTO(gc.getId(), gc.getValue(), gc.getLabel(), gc.getIcon(), gc.getColor(),
                               gc.getIsIncome(), false);
    }

    private static String toValue(String label) {
        return label.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "_");
    }
}
