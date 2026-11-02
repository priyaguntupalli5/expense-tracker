import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { SettingsService } from '../../services/settings.service';
import { Expense, FixedExpense, monthlyEquivalent, monthOccurrences } from '../../models/expense.model';
import { FixedExpenseFormComponent } from '../fixed-expense-form/fixed-expense-form.component';

function nth(n: number): string {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const MONTH_YEAR = { year: 'numeric', month: 'long' } as const;

@Component({
  selector: 'app-fixed-expenses',
  // The month picker shows and edits "November 2026" rather than a full date
  providers: [provideNativeDateAdapter({
    parse:   { dateInput: null },
    display: {
      dateInput: MONTH_YEAR,
      monthYearLabel: { year: 'numeric', month: 'short' },
      dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
      monthYearA11yLabel: MONTH_YEAR,
    },
  })],
  imports: [
    CurrencyPipe, DatePipe,
    MatTableModule, MatIconModule, MatButtonModule,
    MatTooltipModule, MatCardModule, MatFormFieldModule,
    MatDatepickerModule, MatInputModule,
  ],
  templateUrl: './fixed-expenses.component.html',
  styleUrl: './fixed-expenses.component.scss',
})
export class FixedExpensesComponent implements OnInit {
  private readonly expenseService = inject(ExpenseService);
  private readonly dialog         = inject(MatDialog);
  private readonly snackBar       = inject(MatSnackBar);
  private readonly route          = inject(ActivatedRoute);
  readonly settingsService        = inject(SettingsService);

  expenses: FixedExpense[] = [];
  entries:  Expense[]      = [];
  titleFilter = '';
  highlightId: number | null = null;

  /** Fixed expenses whose start/end dates overlap the selected month. */
  get activeExpenses(): FixedExpense[] {
    const first = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-01`;
    const last  = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-` +
                  String(new Date(this.selectedYear, this.selectedMonth, 0).getDate()).padStart(2, '0');
    return this.expenses.filter(e =>
      (!e.startDate || e.startDate <= last) && (!e.endDate || e.endDate >= first));
  }

  get filteredExpenses(): FixedExpense[] {
    if (!this.titleFilter) return this.activeExpenses;
    const t = this.titleFilter.toLowerCase();
    return this.activeExpenses.filter(e => e.title.toLowerCase().includes(t));
  }

  clearTitleFilter() { this.titleFilter = ''; }
  displayedColumns      = ['title', 'category', 'amount', 'actions'];
  entryDisplayedColumns = ['title', 'date', 'amount', 'actions'];

  selectedMonth = new Date().getMonth() + 1;
  selectedYear  = new Date().getFullYear();

  get selectedDate(): Date { return new Date(this.selectedYear, this.selectedMonth - 1, 1); }
  get monthLabel(): string { return this.selectedDate.toLocaleDateString('en-US', { month: 'long' }); }

  ngOnInit() {
    this.expenseService.loadCategories().subscribe();
    this.route.queryParams.subscribe(params => {
      if (params['title'])      this.titleFilter = params['title'];
      if (params['highlightId']) this.highlightId = Number(params['highlightId']);
      // Opened from the dashboard: show the month that was being viewed there
      if (params['month'] && params['year']) {
        this.selectedMonth = Number(params['month']);
        this.selectedYear  = Number(params['year']);
      }
    });
    this.load();
  }

  pickMonth(date: Date, picker: MatDatepicker<Date>) {
    picker.close();
    this.setMonth(date);
  }

  shiftMonth(delta: number) {
    this.setMonth(new Date(this.selectedYear, this.selectedMonth - 1 + delta, 1));
  }

  private setMonth(date: Date) {
    this.selectedMonth = date.getMonth() + 1;
    this.selectedYear  = date.getFullYear();
    this.loadEntries();
  }

  private scrollToRow(id: number) {
    setTimeout(() => {
      const el = document.getElementById(`fixed-row-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('row--highlighted');
        setTimeout(() => el.classList.remove('row--highlighted'), 3000);
      }
    }, 150);
  }

  private load() {
    forkJoin([
      this.expenseService.getFixedExpenses(),
      this.expenseService.getFixedEntries(this.selectedMonth, this.selectedYear),
    ]).subscribe(([expenses, entries]) => {
      this.expenses = expenses;
      this.entries  = entries;
      if (this.highlightId) this.scrollToRow(this.highlightId);
    });
  }

  private loadEntries() {
    this.expenseService.getFixedEntries(this.selectedMonth, this.selectedYear)
      .subscribe(entries => { this.entries = entries; });
  }

  isCredit(categoryValue: string, subcategory?: string): boolean {
    if (this.expenseService.getCategoryByValue(categoryValue)?.isIncome) return true;
    return (subcategory ?? '').toLowerCase().trim() === 'refunds & credits';
  }

  /** Actual cost for the selected month. */
  get total(): number {
    return this.activeExpenses.reduce((sum, e) => {
      const occ  = monthOccurrences(e, this.selectedMonth, this.selectedYear);
      const cost = occ !== null ? occ * Number(e.amount) : monthlyEquivalent(e);
      return sum + (this.isCredit(e.category, e.subcategory) ? -cost : cost);
    }, 0);
  }

  get entriesTotal(): number {
    return this.entries.reduce((s, e) =>
      s + (this.isCredit(e.category, e.subcategory) ? -Number(e.amount) : Number(e.amount)), 0);
  }

  scheduleLabel(fe: FixedExpense): string {
    const r  = fe.recurrence ?? 'MONTHLY';
    const sd = fe.startDate ? new Date(fe.startDate + 'T00:00:00') : null;

    const fallback: Record<string, string> = {
      WEEKLY: 'weekly', BIWEEKLY: 'every 2 weeks',
      MONTHLY: 'monthly', QUARTERLY: 'quarterly', YEARLY: 'yearly',
    };
    if (!sd) return fallback[r] ?? r.toLowerCase();

    const day       = sd.getDate();
    const dayName   = sd.toLocaleDateString('en-US', { weekday: 'long' });
    const monthName = sd.toLocaleDateString('en-US', { month: 'long' });

    switch (r) {
      case 'WEEKLY':    return `every ${dayName}`;
      case 'BIWEEKLY':  return `every other ${dayName}`;
      case 'MONTHLY':   return `${nth(day)} of each month`;
      case 'QUARTERLY': return `${nth(day)} each quarter`;
      case 'YEARLY':    return `${monthName} ${nth(day)}`;
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
    if (!confirm(`Delete "${expense.title}"? Past payments already recorded stay in your history — this only stops future occurrences from being generated.`)) return;
    this.expenseService.deleteFixedExpense(expense.id!).subscribe({
      next: () => {
        this.snackBar.open('Fixed expense deleted', 'Dismiss', { duration: 3000 });
        this.load();
        this.expenseService.notifyRefresh();
      },
      error: () => this.snackBar.open('Failed to delete', 'Dismiss', { duration: 3000 }),
    });
  }

  confirmDeleteEntry(entry: Expense) {
    if (!confirm(`Delete this payment entry for "${entry.title}"?`)) return;
    this.expenseService.delete(entry.id!).subscribe({
      next: () => {
        this.snackBar.open('Entry deleted', 'Dismiss', { duration: 3000 });
        this.loadEntries();
        this.expenseService.notifyRefresh();
      },
      error: () => this.snackBar.open('Failed to delete', 'Dismiss', { duration: 3000 }),
    });
  }

  getCategoryLabel(value: string) { return this.expenseService.getCategoryByValue(value)?.label ?? value; }
  getCategoryIcon(value: string)  { return this.expenseService.getCategoryByValue(value)?.icon  ?? 'more_horiz'; }
  getCategoryColor(value: string) { return this.expenseService.getCategoryByValue(value)?.color ?? '#607d8b'; }
}
