package com.expensetracker.controller;

import com.expensetracker.dto.BulkTagRequest;
import com.expensetracker.model.BankAccount;
import com.expensetracker.model.User;
import com.expensetracker.repository.BankAccountRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bank-accounts")
public class BankAccountController {

    private final BankAccountRepository repository;

    public BankAccountController(BankAccountRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<BankAccount> getAll(@AuthenticationPrincipal User user) {
        return repository.findByGroupId(user.getGroup().getId());
    }

    @PostMapping
    public ResponseEntity<BankAccount> create(@AuthenticationPrincipal User user,
                                              @Valid @RequestBody BankAccount account) {
        account.setId(null);
        account.setGroupId(user.getGroup().getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(repository.save(account));
    }

    @PutMapping("/{id}")
    public ResponseEntity<BankAccount> update(@AuthenticationPrincipal User user,
                                              @PathVariable Long id,
                                              @Valid @RequestBody BankAccount updated) {
        return repository.findByIdAndGroupId(id, user.getGroup().getId()).map(existing -> {
            existing.setOwnerName(updated.getOwnerName());
            existing.setAccountName(updated.getAccountName());
            existing.setOpeningBalance(updated.getOpeningBalance());
            return ResponseEntity.ok(repository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        if (!repository.existsByIdAndGroupId(id, user.getGroup().getId())) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/tags")
    public List<String> getTags(@AuthenticationPrincipal User user) {
        return repository.findDistinctTagsByGroupId(user.getGroup().getId());
    }

    @PatchMapping("/bulk-tag")
    public ResponseEntity<Void> bulkTag(@AuthenticationPrincipal User user,
                                        @RequestBody BulkTagRequest request) {
        applyTag(request, user.getGroup().getId(), true);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/bulk-untag")
    public ResponseEntity<Void> bulkUntag(@AuthenticationPrincipal User user,
                                          @RequestBody BulkTagRequest request) {
        applyTag(request, user.getGroup().getId(), false);
        return ResponseEntity.noContent().build();
    }

    private void applyTag(BulkTagRequest request, Long groupId, boolean add) {
        List<Long> ids = request.getIds();
        String tag = request.getTag();
        if (ids == null || ids.isEmpty() || tag == null || tag.isBlank()) return;

        String normalized = tag.trim();
        List<BankAccount> accounts = repository.findByIdInAndGroupId(ids, groupId);
        for (BankAccount account : accounts) {
            if (add) account.getTags().add(normalized);
            else account.getTags().remove(normalized);
        }
        repository.saveAll(accounts);
    }
}
