import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, combineLatest, switchMap, takeUntil, merge, startWith, filter } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { Expense } from '../../models/expense.model';
import { ExpenseFormComponent } from '../expense-form/expense-form.component';

@Component({
  selector: 'app-expense-list',
  providers: [provideNativeDateAdapter()],
  imports: [
    CurrencyPipe, DatePipe, ReactiveFormsModule,
    MatTableModule, MatIconModule, MatButtonModule,
    MatTooltipModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
  ],
  templateUrl: './expense-list.component.html',
  styleUrl: './expense-list.component.scss',
})
export class ExpenseListComponent implements OnInit, OnDestroy {
  private readonly expenseService = inject(ExpenseService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroy$ = new Subject<void>();

  expenses: Expense[] = [];
  displayedColumns = ['date', 'title', 'category', 'amount', 'actions'];

  readonly startCtrl    = new FormControl<Date | null>(null);
  readonly endCtrl      = new FormControl<Date | null>(null);
  readonly categoryCtrl = new FormControl<string>('');

  get categories() { return this.expenseService.categories; }

  get filteredExpenses(): Expense[] {
    const cat = this.categoryCtrl.value;
    if (!cat) return this.expenses;
    return this.expenses.filter(e => e.category === cat);
  }

  isCredit(categoryValue: string): boolean {
    return this.expenseService.getCategoryByValue(categoryValue)?.isIncome ?? false;
  }

  get total(): number {
    return this.filteredExpenses.reduce((sum, e) =>
      sum + (this.isCredit(e.category) ? -Number(e.amount) : Number(e.amount)), 0);
  }

  constructor() {
    const now = new Date();
    this.startCtrl.setValue(new Date(now.getFullYear(), now.getMonth(), 1));
    this.endCtrl.setValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }

  ngOnInit() {
    this.expenseService.loadCategories().subscribe();
    this.categoryCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe();

    combineLatest([
      this.startCtrl.valueChanges.pipe(startWith(this.startCtrl.value)),
      this.endCtrl.valueChanges.pipe(startWith(this.endCtrl.value)),
      merge(this.expenseService.onRefresh$).pipe(startWith(null)),
    ]).pipe(
      filter(([start, end]) => !!start && !!end && (start as Date) <= (end as Date)),
      switchMap(([start, end]) =>
        this.expenseService.getByDateRange(
          this.toDateString(start as Date),
          this.toDateString(end as Date),
        )
      ),
      takeUntil(this.destroy$),
    ).subscribe(expenses => this.expenses = expenses);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private toDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  openAdd() {
    const ref = this.dialog.open(ExpenseFormComponent, { width: '520px', maxWidth: '95vw' });
    ref.afterClosed().subscribe(saved => { if (saved) this.expenseService.notifyRefresh(); });
  }

  openEdit(expense: Expense) {
    const ref = this.dialog.open(ExpenseFormComponent, {
      width: '520px', maxWidth: '95vw', data: expense,
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.expenseService.notifyRefresh(); });
  }

  confirmDelete(expense: Expense) {
    if (!confirm(`Delete "${expense.title}"?`)) return;
    this.expenseService.delete(expense.id!).subscribe({
      next: () => {
        this.snackBar.open('Expense deleted', 'Dismiss', { duration: 3000 });
        this.expenseService.notifyRefresh();
      },
      error: () => this.snackBar.open('Failed to delete expense', 'Dismiss', { duration: 3000 }),
    });
  }

  getCategoryLabel(value: string) { return this.expenseService.getCategoryByValue(value)?.label ?? value; }
  getCategoryIcon(value: string)  { return this.expenseService.getCategoryByValue(value)?.icon ?? 'more_horiz'; }
  getCategoryColor(value: string) { return this.expenseService.getCategoryByValue(value)?.color ?? '#607d8b'; }
}
