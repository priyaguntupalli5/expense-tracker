import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe, NgClass } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { Summary, CATEGORIES, CATEGORY_COLORS } from '../../models/expense.model';

interface PieSlice {
  path: string;
  color: string;
  category: string;
  amount: number;
  percentage: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    CurrencyPipe, NgClass, FormsModule, ReactiveFormsModule,
    MatCardModule, MatSelectModule, MatFormFieldModule,
    MatInputModule, MatIconModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly expenseService = inject(ExpenseService);
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  summary: Summary | null = null;
  selectedMonth = new Date().getMonth() + 1;
  selectedYear  = new Date().getFullYear();
  fixedTotal    = 0;
  pieSlices: PieSlice[] = [];

  salaryForm = this.fb.group({
    priyaSalary: [0],
    vamsiSalary: [0],
  });

  readonly months = [
    { value: 1,  label: 'January' },   { value: 2,  label: 'February' },
    { value: 3,  label: 'March' },     { value: 4,  label: 'April' },
    { value: 5,  label: 'May' },       { value: 6,  label: 'June' },
    { value: 7,  label: 'July' },      { value: 8,  label: 'August' },
    { value: 9,  label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' },  { value: 12, label: 'December' },
  ];

  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  ngOnInit() {
    this.expenseService.onRefresh$.pipe(takeUntil(this.destroy$)).subscribe(() => this.loadData());
    this.loadData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPeriodChange() {
    this.expenseService.setPeriod(this.selectedMonth, this.selectedYear);
    this.loadData();
  }

  saveSalary() {
    const v = this.salaryForm.value;
    this.expenseService.setSalary(this.selectedMonth, this.selectedYear, {
      priyaSalary: Number(v.priyaSalary) || 0,
      vamsiSalary: Number(v.vamsiSalary) || 0,
    }).subscribe();
  }

  private loadData() {
    forkJoin({
      salary:  this.expenseService.getSalary(this.selectedMonth, this.selectedYear),
      fixed:   this.expenseService.getFixedExpenses(),
      summary: this.expenseService.getSummary(this.selectedMonth, this.selectedYear),
    }).pipe(takeUntil(this.destroy$)).subscribe(({ salary, fixed, summary }) => {
      this.salaryForm.patchValue(
        { priyaSalary: Number(salary.priyaSalary), vamsiSalary: Number(salary.vamsiSalary) },
        { emitEvent: false },
      );
      this.fixedTotal = fixed.reduce((sum, e) => sum + Number(e.amount), 0);
      this.summary    = summary;
      this.buildPieChart();
    });
  }

  private buildPieChart() {
    const breakdown = this.summary?.categoryBreakdown ?? {};
    const total     = this.summary?.total ?? 0;
    if (total === 0) { this.pieSlices = []; return; }

    const cx = 100, cy = 100, r = 80;
    const sorted = Object.entries(breakdown).sort(([, a], [, b]) => b - a);

    if (sorted.length === 1) {
      this.pieSlices = [{
        path: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`,
        color: CATEGORY_COLORS[sorted[0][0]] ?? '#607d8b',
        category: sorted[0][0],
        amount: sorted[0][1],
        percentage: 100,
      }];
      return;
    }

    const slices: PieSlice[] = [];
    let angle = -Math.PI / 2;

    for (const [category, amount] of sorted) {
      const sweep    = (amount / total) * 2 * Math.PI;
      const x1       = cx + r * Math.cos(angle);
      const y1       = cy + r * Math.sin(angle);
      const endAngle = angle + sweep;
      const x2       = cx + r * Math.cos(endAngle);
      const y2       = cy + r * Math.sin(endAngle);

      slices.push({
        path: `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
        color: CATEGORY_COLORS[category] ?? '#607d8b',
        category,
        amount,
        percentage: Math.round((amount / total) * 100),
      });

      angle = endAngle;
    }

    this.pieSlices = slices;
  }

  get totalIncome(): number {
    const v = this.salaryForm.value;
    return (Number(v.priyaSalary) || 0) + (Number(v.vamsiSalary) || 0);
  }

  get actualTotal(): number {
    return Number(this.summary?.total ?? 0);
  }

  get savings(): number {
    return this.totalIncome - this.fixedTotal - this.actualTotal;
  }

  formatCompact(amount: number): string {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000)     return `$${(amount / 1_000).toFixed(1)}K`;
    return `$${amount.toFixed(0)}`;
  }

  getCategoryLabel(value: string) {
    return CATEGORIES.find(c => c.value === value)?.label ?? value;
  }

  getCategoryIcon(value: string) {
    return CATEGORIES.find(c => c.value === value)?.icon ?? 'more_horiz';
  }
}
