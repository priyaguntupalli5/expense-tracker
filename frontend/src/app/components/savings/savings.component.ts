import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { SettingsService } from '../../services/settings.service';
import { BankAccount, SavingsEntry } from '../../models/expense.model';
import { BankAccountFormComponent } from '../bank-account-form/bank-account-form.component';

interface SavingsRow {
  account: BankAccount;
  amount: number;
}

@Component({
  selector: 'app-savings',
  imports: [
    CurrencyPipe, FormsModule,
    MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule,
    MatSelectModule, MatFormFieldModule, MatInputModule,
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

  get total(): number {
    return this.rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }

  onPeriodChange() { this.loadEntries(); }

  private load() {
    forkJoin([
      this.expenseService.getBankAccounts(),
      this.expenseService.getSavings(this.selectedMonth, this.selectedYear),
    ]).subscribe(([accounts, entries]) => {
      this.accounts = accounts;
      this.buildRows(entries);
    });
  }

  private loadEntries() {
    this.expenseService.getSavings(this.selectedMonth, this.selectedYear)
      .subscribe(entries => this.buildRows(entries));
  }

  private buildRows(entries: SavingsEntry[]) {
    this.rows = this.accounts.map(account => {
      const entry = entries.find(e => e.bankAccountId === account.id);
      return { account, amount: entry ? Number(entry.amount) : 0 };
    });
  }

  saveRow(row: SavingsRow) {
    this.expenseService.saveSavingsEntry({
      bankAccountId: row.account.id!,
      month: this.selectedMonth,
      year: this.selectedYear,
      amount: row.amount || 0,
    }).subscribe({
      next: () => this.snackBar.open('Savings saved', 'Dismiss', { duration: 2000 }),
      error: () => this.snackBar.open('Failed to save', 'Dismiss', { duration: 3000 }),
    });
  }

  openAdd() {
    const ref = this.dialog.open(BankAccountFormComponent, { width: '420px', maxWidth: '95vw' });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  openEdit(account: BankAccount) {
    const ref = this.dialog.open(BankAccountFormComponent, {
      width: '420px', maxWidth: '95vw', data: account,
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  confirmDelete(account: BankAccount) {
    if (!confirm(`Delete "${account.accountName}"? This also removes its saved monthly amounts.`)) return;
    this.expenseService.deleteBankAccount(account.id!).subscribe({
      next: () => {
        this.snackBar.open('Account deleted', 'Dismiss', { duration: 3000 });
        this.load();
      },
      error: () => this.snackBar.open('Failed to delete', 'Dismiss', { duration: 3000 }),
    });
  }
}
