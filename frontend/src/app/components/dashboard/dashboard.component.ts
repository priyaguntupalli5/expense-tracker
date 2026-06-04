import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subject, takeUntil } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { Summary, CATEGORIES, CATEGORY_COLORS } from '../../models/expense.model';

@Component({
  selector: 'app-dashboard',
  imports: [
    CurrencyPipe, FormsModule,
    MatCardModule, MatSelectModule, MatFormFieldModule,
    MatIconModule, MatProgressBarModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly expenseService = inject(ExpenseService);
  private readonly destroy$ = new Subject<void>();

  summary: Summary | null = null;
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();

  readonly months = [
    { value: 1, label: 'January' },  { value: 2, label: 'February' },
    { value: 3, label: 'March' },    { value: 4, label: 'April' },
    { value: 5, label: 'May' },      { value: 6, label: 'June' },
    { value: 7, label: 'July' },     { value: 8, label: 'August' },
    { value: 9, label: 'September' },{ value: 10, label: 'October' },
    { value: 11, label: 'November' },{ value: 12, label: 'December' },
  ];

  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  ngOnInit() {
    this.expenseService.onRefresh$.pipe(takeUntil(this.destroy$)).subscribe(() => this.loadSummary());
    this.loadSummary();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPeriodChange() {
    this.expenseService.setPeriod(this.selectedMonth, this.selectedYear);
    this.loadSummary();
  }

  private loadSummary() {
    this.expenseService.getSummary(this.selectedMonth, this.selectedYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe(s => this.summary = s);
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

  getCategoryPercentage(amount: number): number {
    if (!this.summary?.total) return 0;
    return Math.round((amount / this.summary.total) * 100);
  }

  get topCategory(): string {
    const breakdown = this.summary?.categoryBreakdown;
    if (!breakdown) return '—';
    const entries = Object.entries(breakdown);
    if (!entries.length) return '—';
    const top = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
    return this.getCategoryLabel(top[0]);
  }

  get sortedCategories(): [string, number][] {
    const breakdown = this.summary?.categoryBreakdown;
    if (!breakdown) return [];
    return Object.entries(breakdown).sort(([, a], [, b]) => b - a);
  }
}
