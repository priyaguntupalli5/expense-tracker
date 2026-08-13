package com.expensetracker.controller;

import com.expensetracker.dto.SavingsBalanceDTO;
import com.expensetracker.dto.TransferRequestDTO;
import com.expensetracker.model.SavingsEntry;
import com.expensetracker.model.User;
import com.expensetracker.repository.BankAccountRepository;
import com.expensetracker.repository.SavingsEntryRepository;
import com.expensetracker.service.SavingsService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/savings")
public class SavingsController {

    private final SavingsEntryRepository repository;
    private final BankAccountRepository  bankAccountRepository;
    private final SavingsService         savingsService;

    public SavingsController(SavingsEntryRepository repository, BankAccountRepository bankAccountRepository,
                              SavingsService savingsService) {
        this.repository            = repository;
        this.bankAccountRepository = bankAccountRepository;
        this.savingsService        = savingsService;
    }

    @GetMapping
    public List<SavingsEntry> getAll(@AuthenticationPrincipal User user,
                                     @RequestParam Integer month,
                                     @RequestParam Integer year) {
        return repository.findByGroupIdAndMonthAndYear(user.getGroup().getId(), month, year);
    }

    @GetMapping("/balances")
    public List<SavingsBalanceDTO> getBalances(@AuthenticationPrincipal User user,
                                               @RequestParam Integer month,
                                               @RequestParam Integer year) {
        return savingsService.getBalances(user.getGroup().getId(), month, year);
    }

    @PostMapping
    public ResponseEntity<SavingsEntry> create(@AuthenticationPrincipal User user,
                                               @Valid @RequestBody SavingsEntry incoming) {
        Long groupId = user.getGroup().getId();
        if (!bankAccountRepository.existsByIdAndGroupId(incoming.getBankAccountId(), groupId)) {
            return ResponseEntity.badRequest().build();
        }

        SavingsEntry entry = new SavingsEntry();
        entry.setBankAccountId(incoming.getBankAccountId());
        entry.setGroupId(groupId);
        entry.setMonth(incoming.getMonth());
        entry.setYear(incoming.getYear());
        entry.setAmount(incoming.getAmount());
        entry.setAssetType(incoming.getAssetType());
        entry.setIsOpeningBalance(incoming.getIsOpeningBalance());
        entry.setNote(incoming.getNote());

        return ResponseEntity.status(HttpStatus.CREATED).body(repository.save(entry));
    }

    @PostMapping("/transfer")
    public ResponseEntity<?> transfer(@AuthenticationPrincipal User user,
                                      @Valid @RequestBody TransferRequestDTO request) {
        String error = savingsService.transfer(user.getGroup().getId(), request);
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("error", error));
        }
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        boolean deleted = savingsService.deleteEntry(user.getGroup().getId(), id);
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
