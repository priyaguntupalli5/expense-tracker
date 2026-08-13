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

    // Returns an error message if the transfer was rejected, or null on success.
    public String transfer(Long groupId, TransferRequestDTO request) {
        if (request.getFromAccountId().equals(request.getToAccountId())) {
            return "From and To accounts must be different.";
        }

        BankAccount fromAccount = bankAccountRepository.findByIdAndGroupId(request.getFromAccountId(), groupId).orElse(null);
        if (fromAccount == null || !bankAccountRepository.existsByIdAndGroupId(request.getToAccountId(), groupId)) {
            return "Account not found.";
        }

        BigDecimal available = balanceForType(groupId, fromAccount, request.getAssetType(), request.getMonth(), request.getYear());
        if (request.getAmount().compareTo(available) > 0) {
            String type = "INVESTMENT".equals(request.getAssetType()) ? "investment" : "cash";
            return "Insufficient " + type + " balance in the source account — only " + available + " available.";
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

        return null;
    }

    // Balance of a single account/asset-type combination up to and including
    // the given period — the same rule getBalances() uses per account, just
    // scoped to one account so transfer() can check it before committing.
    private BigDecimal balanceForType(Long groupId, BankAccount account, String assetType, Integer month, Integer year) {
        BigDecimal sum = "INVESTMENT".equals(assetType) ? BigDecimal.ZERO : account.getOpeningBalance();
        for (SavingsEntry entry : savingsEntryRepository.findByGroupIdAndPeriodUpTo(groupId, year, month)) {
            if (entry.getBankAccountId().equals(account.getId()) && assetType.equals(entry.getAssetType())) {
                sum = sum.add(entry.getAmount());
            }
        }
        return sum;
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
