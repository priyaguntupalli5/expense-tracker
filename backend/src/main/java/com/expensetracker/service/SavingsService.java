package com.expensetracker.service;

import com.expensetracker.dto.SavingsBalanceDTO;
import com.expensetracker.dto.TransferRequestDTO;
import com.expensetracker.model.BankAccount;
import com.expensetracker.model.SavingsEntry;
import com.expensetracker.repository.BankAccountRepository;
import com.expensetracker.repository.SavingsEntryRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class SavingsService {

    private final SavingsEntryRepository savingsEntryRepository;
    private final BankAccountRepository bankAccountRepository;

    public SavingsService(SavingsEntryRepository savingsEntryRepository, BankAccountRepository bankAccountRepository) {
        this.savingsEntryRepository = savingsEntryRepository;
        this.bankAccountRepository = bankAccountRepository;
    }

    public List<SavingsBalanceDTO> getBalances(Long groupId, Integer month, Integer year) {
        List<BankAccount> accounts = bankAccountRepository.findByGroupId(groupId);

        Map<Long, BigDecimal> tillDateSums = new HashMap<>();
        Map<Long, BigDecimal> cashTillDateSums = new HashMap<>();
        Map<Long, BigDecimal> investmentTillDateSums = new HashMap<>();
        for (SavingsEntry entry : savingsEntryRepository.findByGroupIdAndPeriodUpTo(groupId, year, month)) {
            tillDateSums.merge(entry.getBankAccountId(), entry.getAmount(), BigDecimal::add);
            Map<Long, BigDecimal> typeSums = "INVESTMENT".equals(entry.getAssetType()) ? investmentTillDateSums : cashTillDateSums;
            typeSums.merge(entry.getBankAccountId(), entry.getAmount(), BigDecimal::add);
        }

        Map<Long, BigDecimal> thisMonthSums = new HashMap<>();
        Map<Long, BigDecimal> cashThisMonthSums = new HashMap<>();
        Map<Long, BigDecimal> investmentThisMonthSums = new HashMap<>();
        for (SavingsEntry entry : savingsEntryRepository.findByGroupIdAndMonthAndYear(groupId, month, year)) {
            if (!entry.getIsTransfer() && !entry.getIsOpeningBalance()) {
                thisMonthSums.merge(entry.getBankAccountId(), entry.getAmount(), BigDecimal::add);
                Map<Long, BigDecimal> typeSums = "INVESTMENT".equals(entry.getAssetType()) ? investmentThisMonthSums : cashThisMonthSums;
                typeSums.merge(entry.getBankAccountId(), entry.getAmount(), BigDecimal::add);
            }
        }

        return accounts.stream()
            .map(account -> new SavingsBalanceDTO(
                account.getId(),
                account.getOpeningBalance().add(tillDateSums.getOrDefault(account.getId(), BigDecimal.ZERO)),
                thisMonthSums.getOrDefault(account.getId(), BigDecimal.ZERO),
                // the opening balance predates per-entry typing, so it's folded into cash
                account.getOpeningBalance().add(cashTillDateSums.getOrDefault(account.getId(), BigDecimal.ZERO)),
                investmentTillDateSums.getOrDefault(account.getId(), BigDecimal.ZERO),
                cashThisMonthSums.getOrDefault(account.getId(), BigDecimal.ZERO),
                investmentThisMonthSums.getOrDefault(account.getId(), BigDecimal.ZERO)
            ))
            .toList();
    }

    public boolean transfer(Long groupId, TransferRequestDTO request) {
        if (request.getFromAccountId().equals(request.getToAccountId())) {
            return false;
        }
        if (!bankAccountRepository.existsByIdAndGroupId(request.getFromAccountId(), groupId)
            || !bankAccountRepository.existsByIdAndGroupId(request.getToAccountId(), groupId)) {
            return false;
        }

        SavingsEntry outgoing = new SavingsEntry();
        outgoing.setBankAccountId(request.getFromAccountId());
        outgoing.setGroupId(groupId);
        outgoing.setMonth(request.getMonth());
        outgoing.setYear(request.getYear());
        outgoing.setAmount(request.getAmount().negate());
        outgoing.setAssetType(request.getAssetType());
        outgoing.setIsTransfer(true);
        outgoing.setNote(request.getNote());

        SavingsEntry incoming = new SavingsEntry();
        incoming.setBankAccountId(request.getToAccountId());
        incoming.setGroupId(groupId);
        incoming.setMonth(request.getMonth());
        incoming.setYear(request.getYear());
        incoming.setAmount(request.getAmount());
        incoming.setAssetType(request.getAssetType());
        incoming.setIsTransfer(true);
        incoming.setNote(request.getNote());

        outgoing = savingsEntryRepository.save(outgoing);
        incoming = savingsEntryRepository.save(incoming);

        outgoing.setLinkedEntryId(incoming.getId());
        incoming.setLinkedEntryId(outgoing.getId());
        savingsEntryRepository.save(outgoing);
        savingsEntryRepository.save(incoming);

        return true;
    }

    public boolean deleteEntry(Long groupId, Long id) {
        return savingsEntryRepository.findByIdAndGroupId(id, groupId).map(entry -> {
            if (entry.getIsTransfer() && entry.getLinkedEntryId() != null) {
                savingsEntryRepository.findByIdAndGroupId(entry.getLinkedEntryId(), groupId)
                    .ifPresent(savingsEntryRepository::delete);
            }
            savingsEntryRepository.delete(entry);
            return true;
        }).orElse(false);
    }
}
