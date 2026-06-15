package com.expensetracker.repository;

import com.expensetracker.model.JoinRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JoinRequestRepository extends JpaRepository<JoinRequest, Long> {
    List<JoinRequest> findByGroup_Id(Long groupId);
    boolean existsByUsernameAndGroup_Id(String username, Long groupId);
    Optional<JoinRequest> findByIdAndGroup_Id(Long id, Long groupId);
}
