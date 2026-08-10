package com.expensetracker.controller;

import com.expensetracker.model.SavingsEntry;
import com.expensetracker.model.User;
import com.expensetracker.repository.BankAccountRepository;
import com.expensetracker.repository.SavingsEntryRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/savings")
public class SavingsController {

    private final SavingsEntryRepository repository;
    private final BankAccountRepository  bankAccountRepository;

    public SavingsController(SavingsEntryRepository repository, BankAccountRepository bankAccountRepository) {
        this.repository            = repository;
        this.bankAccountRepository = bankAccountRepository;
    }

    @GetMapping
    public List<SavingsEntry> getAll(@AuthenticationPrincipal User user,
                                     @RequestParam Integer month,
                                     @RequestParam Integer year) {
        return repository.findByGroupIdAndMonthAndYear(user.getGroup().getId(), month, year);
    }

    @PostMapping
    public ResponseEntity<SavingsEntry> upsert(@AuthenticationPrincipal User user,
                                               @Valid @RequestBody SavingsEntry incoming) {
        Long groupId = user.getGroup().getId();
        if (!bankAccountRepository.existsByIdAndGroupId(incoming.getBankAccountId(), groupId)) {
            return ResponseEntity.badRequest().build();
        }

        SavingsEntry entry = repository
            .findByBankAccountIdAndMonthAndYear(incoming.getBankAccountId(), incoming.getMonth(), incoming.getYear())
            .orElseGet(SavingsEntry::new);

        entry.setBankAccountId(incoming.getBankAccountId());
        entry.setGroupId(groupId);
        entry.setMonth(incoming.getMonth());
        entry.setYear(incoming.getYear());
        entry.setAmount(incoming.getAmount());

        return ResponseEntity.ok(repository.save(entry));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        if (!repository.existsByIdAndGroupId(id, user.getGroup().getId())) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
