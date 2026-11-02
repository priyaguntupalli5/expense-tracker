package com.expensetracker.controller;

import com.expensetracker.dto.SubcategoryDTO;
import com.expensetracker.model.GroupCategory;
import com.expensetracker.model.GroupSubcategory;
import com.expensetracker.model.User;
import com.expensetracker.repository.GroupCategoryRepository;
import com.expensetracker.repository.GroupSubcategoryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/subcategories")
public class SubcategoryController {

    // Built into every spending category: entries filed under it are money back, and the frontend
    // shows them green with a "+" and subtracts them from totals. Matched case-insensitively there too.
    static final String REFUNDS = "Refunds & Credits";

    private final GroupSubcategoryRepository groupSubcategoryRepo;
    private final GroupCategoryRepository    groupCategoryRepo;

    public SubcategoryController(GroupSubcategoryRepository groupSubcategoryRepo,
                                 GroupCategoryRepository groupCategoryRepo) {
        this.groupSubcategoryRepo = groupSubcategoryRepo;
        this.groupCategoryRepo    = groupCategoryRepo;
    }

    @GetMapping
    public List<SubcategoryDTO> getByCategory(@AuthenticationPrincipal User user,
                                              @RequestParam String category) {
        Long groupId = user.getGroup().getId();
        List<SubcategoryDTO> subs = new ArrayList<>(
            groupSubcategoryRepo.findByGroupIdAndCategoryValueOrderByNameAsc(groupId, category).stream()
                .filter(gs -> !isRefunds(gs.getName()))
                .map(gs -> new SubcategoryDTO(gs.getId(), gs.getCategoryValue(), gs.getName(), false))
                .toList());

        // Not stored per group, so it also appears in categories created later. Marked shared so it
        // can't be removed. The Refunds & Credits category itself (income-type) doesn't need it.
        boolean incomeCategory = groupCategoryRepo.findByGroupIdAndValue(groupId, category)
                .map(GroupCategory::getIsIncome).orElse(false);
        if (!incomeCategory) subs.add(new SubcategoryDTO(null, category, REFUNDS, true));
        return subs;
    }

    private static boolean isRefunds(String name) {
        return name != null && name.trim().equalsIgnoreCase(REFUNDS);
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal User user,
                                    @RequestBody Map<String, String> body) {
        Long groupId      = user.getGroup().getId();
        String name       = body.getOrDefault("name", "").trim();
        String catValue   = body.get("categoryValue");

        if (name.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name is required."));
        }
        if (name.length() > 100) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name must be 100 characters or fewer."));
        }

        boolean exists = isRefunds(name) || groupSubcategoryRepo
                .findByGroupIdAndCategoryValueOrderByNameAsc(groupId, catValue)
                .stream().anyMatch(s -> s.getName().equalsIgnoreCase(name));

        if (exists) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "\"" + name + "\" already exists in this category."));
        }

        GroupSubcategory gs = new GroupSubcategory();
        gs.setGroupId(groupId);
        gs.setCategoryValue(catValue);
        gs.setName(name);
        GroupSubcategory saved = groupSubcategoryRepo.save(gs);
        return ResponseEntity.ok(new SubcategoryDTO(saved.getId(), saved.getCategoryValue(), saved.getName(), false));
    }

    /** Deletes a group-owned subcategory. Shared subcategories cannot be removed. */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        Long groupId = user.getGroup().getId();
        Optional<GroupSubcategory> opt = groupSubcategoryRepo.findByGroupIdAndId(groupId, id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        groupSubcategoryRepo.delete(opt.get());
        return ResponseEntity.noContent().build();
    }
}
