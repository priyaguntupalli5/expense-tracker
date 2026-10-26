import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { ExpenseService } from './expense.service';
import { SettingsService } from './settings.service';
import { Expense } from '../models/expense.model';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

/** Builds the downloadable monthly expense report (CSV that opens directly in Excel / Sheets). */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly expenseService  = inject(ExpenseService);
  private readonly settingsService = inject(SettingsService);

  /**
   * Fetches the month's regular expenses and generated fixed-expense entries, merges them in
   * date order and downloads them. Emits the number of rows written (0 = nothing that month).
   */
  downloadMonthlyReport(month: number, year: number): Observable<number> {
    return forkJoin({
      categories: this.expenseService.loadCategories(),
      expenses:   this.expenseService.getAll(month, year),
      fixed:      this.expenseService.getFixedEntries(month, year),
    }).pipe(map(({ categories, expenses, fixed }) => {
      const labelOf  = new Map(categories.map(c => [c.value, c.label]));
      const isIncome = new Set(categories.filter(c => c.isIncome).map(c => c.value));

      // Same scope as the dashboard: income categories aren't expenses
      const rows = [
        ...expenses.map(e => ({ e, type: 'Expense' })),
        ...fixed.map(e => ({ e, type: 'Fixed' })),
      ]
        .filter(({ e }) => !isIncome.has(e.category))
        .sort((a, b) => a.e.date.localeCompare(b.e.date)
                     || a.type.localeCompare(b.type)      // Expense before Fixed on the same day
                     || a.e.title.localeCompare(b.e.title));

      const currency = this.settingsService.currency;
      const lines: string[][] = [
        ['Date', 'Type', 'Category', 'Subcategory', 'Title', `Amount (${currency})`, 'Labels', 'Notes'],
      ];
      let total = 0;
      for (const { e, type } of rows) {
        const amount = this.signedAmount(e);
        total += amount;
        lines.push([
          e.date, type, labelOf.get(e.category) ?? e.category, e.subcategory ?? '',
          e.title, amount.toFixed(2), (e.tags ?? []).join('; '), e.notes ?? '',
        ]);
      }
      lines.push([]);
      lines.push(['', '', '', '', 'Total', total.toFixed(2), '', '']);

      this.saveCsv(lines, `expenses-${year}-${String(month).padStart(2, '0')}-${MONTH_NAMES[month - 1]}.csv`);
      return rows.length;
    }));
  }

  // Refunds reduce spending, matching how the dashboard totals them
  private signedAmount(e: Expense): number {
    const refund = (e.subcategory ?? '').toLowerCase().trim() === 'refunds & credits';
    return refund ? -Number(e.amount) : Number(e.amount);
  }

  private saveCsv(lines: string[][], filename: string) {
    const csv  = lines.map(cols => cols.map((c, i) => this.cell(c, i === 5)).join(',')).join('\r\n');
    // BOM so Excel reads UTF-8 (accents, currency symbols) correctly
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private cell(value: string, isAmount: boolean): string {
    let v = value ?? '';
    // Text starting with = + - @ would run as a formula in Excel; amounts are left numeric
    if (!isAmount && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
    return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }
}
