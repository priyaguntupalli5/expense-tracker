import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule, FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { SettingsService } from '../../services/settings.service';
import { BankAccount, SavingsBalance, SavingsEntry } from '../../models/expense.model';
import { BankAccountFormComponent } from '../bank-account-form/bank-account-form.component';
import { SavingsTransferFormComponent } from '../savings-transfer-form/savings-transfer-form.component';

interface SavingsRow {
  account: BankAccount;
  tillDate: number;
  thisMonth: number;
  cashTillDate: number;
  investmentTillDate: number;
  cashThisMonth: number;
  investmentThisMonth: number;
  entries: SavingsEntry[];
}

@Component({
  selector: 'app-savings',
  imports: [
    CurrencyPipe, FormsModule, ReactiveFormsModule,
    MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule,
    MatSelectModule, MatFormFieldModule, MatInputModule, MatAutocompleteModule, MatCheckboxModule,
  ],
  templateUrl: './savings.component.html',
  styleUrl: './savings.component.scss',
})
export class SavingsComponent implements OnInit, OnDestroy {
  private readonly expenseService = inject(ExpenseService);
  private readonly dialog         = inject(MatDialog);
  private readonly snackBar       = inject(MatSnackBar);
  private readonly route          = inject(ActivatedRoute);
  private readonly destroy$       = new Subject<void>();
  readonly settingsService        = inject(SettingsService);

  accounts: BankAccount[] = [];
  rows: SavingsRow[] = [];
  private balances: SavingsBalance[] = [];
  expandedAccountId: number | null = null;
  highlightId: number | null = null;

  availableTags: string[] = [];
  taggingAccountId: number | null = null;
  readonly tagCtrl = new FormControl<string>('');

  // Selection & bulk label-apply state
  selectionMode = false;
  selectedIds = new Set<number>();

  selectedMonth = new Date().getMonth() + 1;
  selectedYear  = new Date().getFullYear();

  readonly months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' },   { value: 4, label: 'April' },
    { value: 5, label: 'May' },     { value: 6, label: 'June' },
    { value: 7, label: 'July' },    { value: 8, label: 'August' },
    { value: 9, label: 'September' },{ value: 10,label: 'October' },
    { value: 11,label: 'November' },{ value: 12,label: 'December' },
  ];
  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  ngOnInit() {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['highlightId']) this.highlightId = Number(params['highlightId']);
    });
    this.load();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private scrollToRow(id: number) {
    setTimeout(() => {
      const el = document.getElementById(`savings-row-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('row--highlighted');
        setTimeout(() => el.classList.remove('row--highlighted'), 3000);
      }
    }, 150);
  }

  get tillDateTotal(): number {
    return this.rows.reduce((sum, r) => sum + r.tillDate, 0);
  }

  get thisMonthTotal(): number {
    return this.rows.reduce((sum, r) => sum + r.thisMonth, 0);
  }

  onPeriodChange() { this.loadPeriodData(); }

  toggleExpand(accountId: number) {
    if (this.selectionMode) return;
    this.expandedAccountId = this.expandedAccountId === accountId ? null : accountId;
  }

  get allSelected(): boolean {
    const ids = this.rows.map(r => r.account.id!);
    return ids.length > 0 && ids.every(id => this.selectedIds.has(id));
  }

  get someSelected(): boolean { return this.selectedIds.size > 0; }

  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    if (this.selectionMode) {
      this.expandedAccountId = null;
      if (this.availableTags.length === 0) {
        this.expenseService.getBankAccountTags().subscribe(tags => { this.availableTags = tags.sort(); });
      }
    } else {
      this.selectedIds.clear();
      this.tagCtrl.setValue('');
    }
  }

  isSelected(id: number): boolean { return this.selectedIds.has(id); }

  toggleSelectAccount(id: number) {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }

  selectAll() {
    const ids = this.rows.map(r => r.account.id!);
    if (this.allSelected) ids.forEach(id => this.selectedIds.delete(id));
    else ids.forEach(id => this.selectedIds.add(id));
  }

  applyBulkTag() {
    const tag = this.tagCtrl.value?.trim() ?? '';
    const ids = [...this.selectedIds];
    if (!ids.length || !tag) return;
    this.expenseService.addBankAccountTag(ids, tag).subscribe({
      next: () => {
        this.rows.forEach(r => {
          if (r.account.id && this.selectedIds.has(r.account.id)) {
            r.account.tags = [...new Set([...(r.account.tags ?? []), tag])];
          }
        });
        if (!this.availableTags.includes(tag)) this.availableTags = [...this.availableTags, tag].sort();
        this.snackBar.open(`Label "${tag}" applied to ${ids.length} account(s)`, 'OK', { duration: 3000 });
        this.selectedIds.clear();
        this.tagCtrl.setValue('');
        this.selectionMode = false;
      },
      error: () => this.snackBar.open('Failed to apply label', 'Dismiss', { duration: 3000 }),
    });
  }

  cancelSelection() {
    this.selectionMode = false;
    this.selectedIds.clear();
    this.tagCtrl.setValue('');
  }

  private load() {
    forkJoin([
      this.expenseService.getBankAccounts(),
      this.expenseService.getSavingsBalances(this.selectedMonth, this.selectedYear),
      this.expenseService.getSavings(this.selectedMonth, this.selectedYear),
    ]).subscribe(([accounts, balances, entries]) => {
      this.accounts = accounts;
      this.buildRows(balances, entries);
      if (this.highlightId) {
        this.expandedAccountId = this.highlightId;
        this.scrollToRow(this.highlightId);
      }
    });
  }

  private loadPeriodData() {
    forkJoin([
      this.expenseService.getSavingsBalances(this.selectedMonth, this.selectedYear),
      this.expenseService.getSavings(this.selectedMonth, this.selectedYear),
    ]).subscribe(([balances, entries]) => this.buildRows(balances, entries));
  }

  private buildRows(balances: SavingsBalance[], entries: SavingsEntry[]) {
    this.balances = balances;
    this.rows = this.accounts.map(account => {
      const balance = balances.find(b => b.bankAccountId === account.id);
      const opening = Number(account.openingBalance || 0);
      return {
        account,
        tillDate:             balance ? Number(balance.tillDate) : opening,
        thisMonth:            balance ? Number(balance.thisMonth) : 0,
        cashTillDate:         balance ? Number(balance.cashTillDate) : opening,
        investmentTillDate:   balance ? Number(balance.investmentTillDate) : 0,
        cashThisMonth:        balance ? Number(balance.cashThisMonth) : 0,
        investmentThisMonth:  balance ? Number(balance.investmentThisMonth) : 0,
        entries: entries.filter(e => e.bankAccountId === account.id),
      };
    });
  }

  openTransfer() {
    if (this.accounts.length < 2) return;
    const ref = this.dialog.open(SavingsTransferFormComponent, {
      width: '440px', maxWidth: '95vw',
      data: { accounts: this.accounts, balances: this.balances, month: this.selectedMonth, year: this.selectedYear },
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.loadPeriodData(); });
  }

  deleteEntry(entry: SavingsEntry) {
    const label = entry.isTransfer ? 'this transfer' : 'this entry';
    if (!confirm(`Delete ${label}?`)) return;
    this.expenseService.deleteSavingsEntry(entry.id!).subscribe({
      next: () => {
        this.snackBar.open('Entry deleted', 'Dismiss', { duration: 2000 });
        this.loadPeriodData();
      },
      error: () => this.snackBar.open('Failed to delete', 'Dismiss', { duration: 3000 }),
    });
  }

  openAdd() {
    const ref = this.dialog.open(BankAccountFormComponent, {
      width: '420px', maxWidth: '95vw',
      data: { month: this.selectedMonth, year: this.selectedYear },
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  openEdit(account: BankAccount) {
    const row = this.rows.find(r => r.account.id === account.id);
    const opening = Number(account.openingBalance || 0);
    const ref = this.dialog.open(BankAccountFormComponent, {
      width: '420px', maxWidth: '95vw',
      data: {
        account,
        currentCashBalance:       row ? row.cashTillDate : opening,
        currentInvestmentBalance: row ? row.investmentTillDate : 0,
        currentCashThisMonth:     row ? row.cashThisMonth : 0,
        currentInvestmentThisMonth: row ? row.investmentThisMonth : 0,
        month: this.selectedMonth, year: this.selectedYear,
      },
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  get filteredTags(): string[] {
    const value = (this.tagCtrl.value ?? '').toLowerCase();
    return this.availableTags.filter(t => t.toLowerCase().includes(value));
  }

  startTagging(account: BankAccount) {
    this.taggingAccountId = account.id!;
    this.tagCtrl.setValue('');
    if (this.availableTags.length === 0) {
      this.expenseService.getBankAccountTags().subscribe(tags => { this.availableTags = tags.sort(); });
    }
  }

  cancelTagging() {
    this.taggingAccountId = null;
    this.tagCtrl.setValue('');
  }

  submitTag(account: BankAccount) {
    const tag = this.tagCtrl.value?.trim() ?? '';
    if (!tag) return;
    this.expenseService.addBankAccountTag([account.id!], tag).subscribe({
      next: () => {
        account.tags = [...new Set([...(account.tags ?? []), tag])];
        if (!this.availableTags.includes(tag)) this.availableTags = [...this.availableTags, tag].sort();
        this.cancelTagging();
      },
      error: () => this.snackBar.open('Failed to apply label', 'Dismiss', { duration: 3000 }),
    });
  }

  removeAccountTag(account: BankAccount, tag: string) {
    this.expenseService.removeBankAccountTag([account.id!], tag).subscribe({
      next: () => { account.tags = (account.tags ?? []).filter(t => t !== tag); },
      error: () => this.snackBar.open('Failed to remove label', 'Dismiss', { duration: 3000 }),
    });
  }

  confirmDelete(account: BankAccount) {
    if (!confirm(`Delete "${account.accountName}"? This also removes its savings history.`)) return;
    this.expenseService.deleteBankAccount(account.id!).subscribe({
      next: () => {
        this.snackBar.open('Account deleted', 'Dismiss', { duration: 3000 });
        this.load();
      },
      error: () => this.snackBar.open('Failed to delete', 'Dismiss', { duration: 3000 }),
    });
  }
}
