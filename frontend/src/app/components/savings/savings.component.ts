import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { SettingsService } from '../../services/settings.service';
import { BankAccount, SavingsBalance, SavingsEntry } from '../../models/expense.model';
import { BankAccountFormComponent } from '../bank-account-form/bank-account-form.component';
import { SavingsEntryFormComponent } from '../savings-entry-form/savings-entry-form.component';
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
    CurrencyPipe, FormsModule,
    MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule,
    MatSelectModule, MatFormFieldModule,
  ],
  templateUrl: './savings.component.html',
  styleUrl: './savings.component.scss',
})
export class SavingsComponent implements OnInit {
  private readonly expenseService = inject(ExpenseService);
  private readonly dialog         = inject(MatDialog);
  private readonly snackBar       = inject(MatSnackBar);
  readonly settingsService        = inject(SettingsService);

  accounts: BankAccount[] = [];
  rows: SavingsRow[] = [];
  expandedAccountId: number | null = null;

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
    this.load();
  }

  get tillDateTotal(): number {
    return this.rows.reduce((sum, r) => sum + r.tillDate, 0);
  }

  get thisMonthTotal(): number {
    return this.rows.reduce((sum, r) => sum + r.thisMonth, 0);
  }

  onPeriodChange() { this.loadPeriodData(); }

  toggleExpand(accountId: number) {
    this.expandedAccountId = this.expandedAccountId === accountId ? null : accountId;
  }

  private load() {
    forkJoin([
      this.expenseService.getBankAccounts(),
      this.expenseService.getSavingsBalances(this.selectedMonth, this.selectedYear),
      this.expenseService.getSavings(this.selectedMonth, this.selectedYear),
    ]).subscribe(([accounts, balances, entries]) => {
      this.accounts = accounts;
      this.buildRows(balances, entries);
    });
  }

  private loadPeriodData() {
    forkJoin([
      this.expenseService.getSavingsBalances(this.selectedMonth, this.selectedYear),
      this.expenseService.getSavings(this.selectedMonth, this.selectedYear),
    ]).subscribe(([balances, entries]) => this.buildRows(balances, entries));
  }

  private buildRows(balances: SavingsBalance[], entries: SavingsEntry[]) {
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

  openAddEntry() {
    if (this.accounts.length === 0) return;
    const ref = this.dialog.open(SavingsEntryFormComponent, {
      width: '420px', maxWidth: '95vw',
      data: { accounts: this.accounts, month: this.selectedMonth, year: this.selectedYear },
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.loadPeriodData(); });
  }

  openTransfer() {
    if (this.accounts.length < 2) return;
    const ref = this.dialog.open(SavingsTransferFormComponent, {
      width: '440px', maxWidth: '95vw',
      data: { accounts: this.accounts, month: this.selectedMonth, year: this.selectedYear },
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
