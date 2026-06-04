import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { Expense, CATEGORIES, CATEGORY_COLORS } from '../../models/expense.model';
import { ExpenseFormComponent } from '../expense-form/expense-form.component';

@Component({
  selector: 'app-expense-list',
  imports: [
    CurrencyPipe, DatePipe,
    MatTableModule, MatIconModule, MatButtonModule,
    MatTooltipModule, MatCardModule,
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

  ngOnInit() {
    this.expenseService.period$.pipe(takeUntil(this.destroy$)).subscribe(({ month, year }) => {
      this.load(month, year);
    });
    this.expenseService.onRefresh$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      const { month, year } = this.expenseService.currentPeriod;
      this.load(month, year);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(month: number, year: number) {
    this.expenseService.getAll(month, year)
      .pipe(takeUntil(this.destroy$))
      .subscribe(expenses => this.expenses = expenses);
  }

  openEdit(expense: Expense) {
    const ref = this.dialog.open(ExpenseFormComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: expense,
    });
    ref.afterClosed().subscribe(saved => {
      if (saved) this.expenseService.notifyRefresh();
    });
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

  getCategoryLabel(value: string) {
    return CATEGORIES.find(c => c.value === value)?.label ?? value;
  }

  getCategoryIcon(value: string) {
    return CATEGORIES.find(c => c.value === value)?.icon ?? 'more_horiz';
  }

  getCategoryColor(value: string) {
    return CATEGORY_COLORS[value] ?? '#607d8b';
  }
}
