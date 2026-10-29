package com.expensetracker.repository;

import com.expensetracker.model.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface GroupRepository extends JpaRepository<Group, Long> {
    Optional<Group> findByName(String name);
    boolean existsByName(String name);
    Optional<Group> findByGroupCode(String groupCode);
    boolean existsByGroupCode(String groupCode);
    long countByDemoTrueAndCreatedAtAfter(LocalDateTime since);
}
