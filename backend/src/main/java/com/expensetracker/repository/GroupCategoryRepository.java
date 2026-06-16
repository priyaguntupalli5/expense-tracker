package com.expensetracker.repository;

import com.expensetracker.model.GroupCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupCategoryRepository extends JpaRepository<GroupCategory, Long> {
    List<GroupCategory> findByGroupId(Long groupId);
    Optional<GroupCategory> findByGroupIdAndValue(Long groupId, String value);
    boolean existsByGroupIdAndValueAndIdNot(Long groupId, String value, Long id);
}
