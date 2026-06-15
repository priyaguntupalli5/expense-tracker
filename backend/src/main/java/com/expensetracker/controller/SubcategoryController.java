package com.expensetracker.controller;

import com.expensetracker.dto.SubcategoryDTO;
import com.expensetracker.model.GroupSubcategory;
import com.expensetracker.model.Subcategory;
import com.expensetracker.model.User;
import com.expensetracker.repository.GroupSubcategoryRepository;
import com.expensetracker.repository.SubcategoryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/subcategories")
public class SubcategoryController {

    private final SubcategoryRepository      subcategoryRepo;
    private final GroupSubcategoryRepository groupSubcategoryRepo;

    public SubcategoryController(SubcategoryRepository subcategoryRepo,
                                 GroupSubcategoryRepository groupSubcategoryRepo) {
        this.subcategoryRepo      = subcategoryRepo;
        this.groupSubcategoryRepo = groupSubcategoryRepo;
    }

    /**
     * Returns shared subcategories for the given category followed by this group's own,
     * all sorted alphabetically.
     */
    @GetMapping
    public List<SubcategoryDTO> getByCategory(@AuthenticationPrincipal User user,
                                              @RequestParam String category) {
        Long groupId = user.getGroup().getId();
        List<SubcategoryDTO> result = new ArrayList<>();

        for (Subcategory s : subcategoryRepo.findByCategoryValueOrderByNameAsc(category)) {
            result.add(new SubcategoryDTO(s.getId(), s.getCategoryValue(), s.getName(), true));
        }
        for (GroupSubcategory gs : groupSubcategoryRepo.findByGroupIdAndCategoryValueOrderByNameAsc(groupId, category)) {
            result.add(new SubcategoryDTO(gs.getId(), gs.getCategoryValue(), gs.getName(), false));
        }
        result.sort(Comparator.comparing(SubcategoryDTO::getName, String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    /** Adds a subcategory scoped to the requesting group. */
    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal User user, @RequestBody Subcategory body) {
        Long groupId = user.getGroup().getId();
        String name = body.getName() == null ? "" : body.getName().trim();

        if (name.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name is required."));
        }
        if (name.length() > 100) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name must be 100 characters or fewer."));
        }

        // Duplicate check across shared and group-own subcategories
        boolean existsShared = subcategoryRepo.findByCategoryValueOrderByNameAsc(body.getCategoryValue())
                .stream().anyMatch(s -> s.getName().equalsIgnoreCase(name));
        boolean existsGroup  = groupSubcategoryRepo
                .findByGroupIdAndCategoryValueOrderByNameAsc(groupId, body.getCategoryValue())
                .stream().anyMatch(s -> s.getName().equalsIgnoreCase(name));

        if (existsShared || existsGroup) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "\"" + name + "\" already exists in this category."));
        }

        GroupSubcategory gs = new GroupSubcategory();
        gs.setGroupId(groupId);
        gs.setCategoryValue(body.getCategoryValue());
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
