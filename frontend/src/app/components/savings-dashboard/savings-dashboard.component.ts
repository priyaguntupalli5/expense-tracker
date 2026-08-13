import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { forkJoin } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { SettingsService } from '../../services/settings.service';
import { BankAccount, SavingsBalance } from '../../models/expense.model';

interface AccountRow {
  account: BankAccount;
  tillDate: number;
  thisMonth: number;
  cashTillDate: number;
  investmentTillDate: number;
}

interface AccountSlice {
  path: string;
  color: string;
  account: BankAccount;
  amount: number;
  percentage: number;
  cashTillDate: number;
  investmentTillDate: number;
}

// Fixed-order categorical palette (validated for CVD-safe adjacent pairs) —
// assigned by rank, never cycled or reassigned when the account list changes.
const PALETTE = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
];
const OVERFLOW_COLOR = '#898781'; // muted — used past the 8th account, folded as "Other"

@Component({
  selector: 'app-savings-dashboard',
  imports: [
    CurrencyPipe, FormsModule, RouterLink,
    MatCardModule, MatIconModule, MatButtonModule, MatSelectModule, MatFormFieldModule,
  ],
  templateUrl: './savings-dashboard.component.html',
  styleUrl: './savings-dashboard.component.scss',
})
export class SavingsDashboardComponent implements OnInit {
  private readonly expenseService = inject(ExpenseService);
  readonly settingsService        = inject(SettingsService);

  rows: AccountRow[] = [];
  slices: AccountSlice[] = [];

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

  onPeriodChange() { this.load(); }

  private load() {
    forkJoin([
      this.expenseService.getBankAccounts(),
      this.expenseService.getSavingsBalances(this.selectedMonth, this.selectedYear),
    ]).subscribe(([accounts, balances]) => {
      this.rows = accounts.map(account => {
        const balance = balances.find((b: SavingsBalance) => b.bankAccountId === account.id);
        const opening = Number(account.openingBalance || 0);
        return {
          account,
          tillDate:            balance ? Number(balance.tillDate) : opening,
          thisMonth:           balance ? Number(balance.thisMonth) : 0,
          cashTillDate:        balance ? Number(balance.cashTillDate) : opening,
          investmentTillDate:  balance ? Number(balance.investmentTillDate) : 0,
        };
      });
      this.buildPieChart();
    });
  }

  get totalTillDate(): number {
    return this.rows.reduce((sum, r) => sum + r.tillDate, 0);
  }

  get totalThisMonth(): number {
    return this.rows.reduce((sum, r) => sum + r.thisMonth, 0);
  }

  get ownerCount(): number {
    return new Set(this.rows.map(r => r.account.ownerName)).size;
  }

  formatCompact(amount: number): string {
    return amount.toLocaleString('en-CA', {
      style: 'currency',
      currency: this.settingsService.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private buildPieChart() {
    const positive = this.rows.filter(r => r.tillDate > 0).sort((a, b) => b.tillDate - a.tillDate);
    const nonPositive = this.rows.filter(r => r.tillDate <= 0);
    const positiveTotal = positive.reduce((s, r) => s + r.tillDate, 0);

    const cx = 100, cy = 100, r = 80;
    const slices: AccountSlice[] = [];
    const colorFor = (i: number) => i < PALETTE.length ? PALETTE[i] : OVERFLOW_COLOR;

    if (positiveTotal > 0 && positive.length === 1) {
      slices.push({
        path: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`,
        color: colorFor(0),
        account: positive[0].account,
        amount: positive[0].tillDate,
        percentage: 100,
        cashTillDate: positive[0].cashTillDate,
        investmentTillDate: positive[0].investmentTillDate,
      });
    } else if (positiveTotal > 0) {
      let angle = -Math.PI / 2;
      positive.forEach((row, i) => {
        const sweep    = (row.tillDate / positiveTotal) * 2 * Math.PI;
        const x1       = cx + r * Math.cos(angle);
        const y1       = cy + r * Math.sin(angle);
        const endAngle = angle + sweep;
        const x2       = cx + r * Math.cos(endAngle);
        const y2       = cy + r * Math.sin(endAngle);

        slices.push({
          path: `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
          color: colorFor(i),
          account: row.account,
          amount: row.tillDate,
          percentage: Math.round((row.tillDate / positiveTotal) * 100),
          cashTillDate: row.cashTillDate,
          investmentTillDate: row.investmentTillDate,
        });

        angle = endAngle;
      });
    }

    nonPositive.forEach(row => {
      slices.push({
        path: '', color: OVERFLOW_COLOR, account: row.account, amount: row.tillDate, percentage: 0,
        cashTillDate: row.cashTillDate, investmentTillDate: row.investmentTillDate,
      });
    });

    this.slices = slices;
  }
}
