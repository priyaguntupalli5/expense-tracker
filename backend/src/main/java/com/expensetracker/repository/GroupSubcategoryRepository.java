package com.expensetracker.repository;

import com.expensetracker.model.GroupSubcategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupSubcategoryRepository extends JpaRepository<GroupSubcategory, Long> {
    List<GroupSubcategory> findByGroupIdAndCategoryValueOrderByNameAsc(Long groupId, String categoryValue);
    Optional<GroupSubcategory> findByGroupIdAndId(Long groupId, Long id);
}
