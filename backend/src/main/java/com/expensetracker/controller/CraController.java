package com.expensetracker.controller;

import com.expensetracker.model.CraEntry;
import com.expensetracker.model.User;
import com.expensetracker.repository.CraRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cra")
public class CraController {

    private final CraRepository craRepository;

    public CraController(CraRepository craRepository) {
        this.craRepository = craRepository;
    }

    @GetMapping
    public List<CraEntry> getAll(@AuthenticationPrincipal User user,
                                 @RequestParam(required = false) Integer year) {
        Long gid = user.getGroup().getId();
        return year != null
            ? craRepository.findByGroupIdAndTaxYearOrderByPersonAscSlipTypeAsc(gid, year)
            : craRepository.findByGroupIdOrderByTaxYearDescPersonAscSlipTypeAsc(gid);
    }

    @PostMapping
    public ResponseEntity<CraEntry> create(@AuthenticationPrincipal User user,
                                           @RequestBody CraEntry entry) {
        entry.setId(null);
        entry.setGroupId(user.getGroup().getId());
        return ResponseEntity.status(201).body(craRepository.save(entry));
    }

    @PostMapping("/import")
    public ResponseEntity<List<CraEntry>> importEntries(@AuthenticationPrincipal User user,
                                                        @RequestBody List<CraEntry> entries) {
        Long gid = user.getGroup().getId();
        entries.forEach(e -> { e.setId(null); e.setGroupId(gid); });
        return ResponseEntity.status(201).body(craRepository.saveAll(entries));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CraEntry> update(@AuthenticationPrincipal User user,
                                           @PathVariable Long id,
                                           @RequestBody CraEntry body) {
        CraEntry existing = craRepository.findByIdAndGroupId(id, user.getGroup().getId()).orElse(null);
        if (existing == null) return ResponseEntity.notFound().build();
        existing.setTaxYear(body.getTaxYear());
        existing.setPerson(body.getPerson());
        existing.setSlipType(body.getSlipType());
        existing.setIssuer(body.getIssuer());
        existing.setAmount(body.getAmount());
        existing.setTaxDeducted(body.getTaxDeducted());
        existing.setNotes(body.getNotes());
        return ResponseEntity.ok(craRepository.save(existing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user,
                                       @PathVariable Long id) {
        CraEntry existing = craRepository.findByIdAndGroupId(id, user.getGroup().getId()).orElse(null);
        if (existing == null) return ResponseEntity.notFound().build();
        craRepository.delete(existing);
        return ResponseEntity.noContent().build();
    }
}
