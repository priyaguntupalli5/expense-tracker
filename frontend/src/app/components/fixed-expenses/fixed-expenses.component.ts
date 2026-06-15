import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseService } from '../../services/expense.service';
import { SettingsService } from '../../services/settings.service';
import { FixedExpense, monthlyEquivalent } from '../../models/expense.model';
import { FixedExpenseFormComponent } from '../fixed-expense-form/fixed-expense-form.component';
import { WEEKDAYS, MONTHS } from '../fixed-expense-form/fixed-expense-form.component';

function ordinal(n: number): string {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

@Component({
  selector: 'app-fixed-expenses',
  imports: [
    CurrencyPipe,
    MatTableModule, MatIconModule, MatButtonModule,
    MatTooltipModule, MatCardModule,
  ],
  templateUrl: './fixed-expenses.component.html',
  styleUrl: './fixed-expenses.component.scss',
})
export class FixedExpensesComponent implements OnInit {
  private readonly expenseService = inject(ExpenseService);
  private readonly dialog         = inject(MatDialog);
  private readonly snackBar       = inject(MatSnackBar);
  readonly settingsService        = inject(SettingsService);

  expenses: FixedExpense[] = [];
  displayedColumns = ['title', 'category', 'amount', 'actions'];

  ngOnInit() {
    this.expenseService.loadCategories().subscribe();
    this.load();
  }

  private load() {
    this.expenseService.getFixedExpenses().subscribe(expenses => {
      this.expenses = expenses;
    });
  }

  isCredit(categoryValue: string): boolean {
    return this.expenseService.getCategoryByValue(categoryValue)?.isIncome ?? false;
  }

  /** Monthly-equivalent total (e.g. yearly $1200 → $100/mo). */
  get total(): number {
    return this.expenses.reduce((sum, e) => {
      const mo = monthlyEquivalent(e);
      return sum + (this.isCredit(e.category) ? -mo : mo);
    }, 0);
  }

  scheduleLabel(fe: FixedExpense): string {
    const r = fe.recurrence ?? 'MONTHLY';
    const day = fe.paymentDay;
    const month = fe.paymentMonth;

    if (!day) {
      const labels: Record<string, string> = {
        WEEKLY: 'weekly', BIWEEKLY: 'every 2 weeks',
        MONTHLY: 'monthly', QUARTERLY: 'quarterly', YEARLY: 'yearly',
      };
      return labels[r] ?? r.toLowerCase();
    }

    switch (r) {
      case 'WEEKLY':    return `every ${WEEKDAYS[day - 1]}`;
      case 'BIWEEKLY':  return `every other ${WEEKDAYS[day - 1]}`;
      case 'MONTHLY':   return `${ordinal(day)} of each month`;
      case 'QUARTERLY': return `${ordinal(day)} of each quarter`;
      case 'YEARLY':    return month
        ? `${MONTHS[month - 1]} ${ordinal(day)}`
        : `yearly · day ${day}`;
      default:          return r.toLowerCase();
    }
  }

  openAdd() {
    const ref = this.dialog.open(FixedExpenseFormComponent, { width: '480px', maxWidth: '95vw' });
    ref.afterClosed().subscribe(saved => {
      if (saved) { this.load(); this.expenseService.notifyRefresh(); }
    });
  }

  openEdit(expense: FixedExpense) {
    const ref = this.dialog.open(FixedExpenseFormComponent, {
      width: '480px', maxWidth: '95vw', data: expense,
    });
    ref.afterClosed().subscribe(saved => {
      if (saved) { this.load(); this.expenseService.notifyRefresh(); }
    });
  }

  confirmDelete(expense: FixedExpense) {
    if (!confirm(`Delete "${expense.title}"?`)) return;
    this.expenseService.deleteFixedExpense(expense.id!).subscribe({
      next: () => {
        this.snackBar.open('Fixed expense deleted', 'Dismiss', { duration: 3000 });
        this.load();
        this.expenseService.notifyRefresh();
      },
      error: () => this.snackBar.open('Failed to delete', 'Dismiss', { duration: 3000 }),
    });
  }

  getCategoryLabel(value: string) { return this.expenseService.getCategoryByValue(value)?.label ?? value; }
  getCategoryIcon(value: string)  { return this.expenseService.getCategoryByValue(value)?.icon  ?? 'more_horiz'; }
  getCategoryColor(value: string) { return this.expenseService.getCategoryByValue(value)?.color ?? '#607d8b'; }
}
