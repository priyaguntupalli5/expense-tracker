import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { SettingsService } from '../../services/settings.service';
import { FixedExpense, Summary } from '../../models/expense.model';

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
    CurrencyPipe, FormsModule, ReactiveFormsModule,
    MatCardModule, MatSelectModule, MatFormFieldModule,
    MatInputModule, MatIconModule, MatButtonModule, MatTooltipModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly expenseService = inject(ExpenseService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroy$ = new Subject<void>();
  readonly pushService = inject(PushNotificationService);
  readonly settingsService = inject(SettingsService);

  summary: Summary | null = null;
  selectedMonth = new Date().getMonth() + 1;
  selectedYear  = new Date().getFullYear();
  pieSlices: PieSlice[] = [];
  salarySaved   = false;
  private fixedExpenses: FixedExpense[] = [];

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
    }).subscribe({
      next: () => {
        this.salarySaved = true;
        setTimeout(() => this.salarySaved = false, 2000);
      },
      error: () => this.snackBar.open('Failed to save income', 'OK', { duration: 3000 }),
    });
  }

  private loadData() {
    forkJoin({
      categories: this.expenseService.loadCategories(),
      salary:     this.expenseService.getSalary(this.selectedMonth, this.selectedYear),
      fixed:      this.expenseService.getFixedExpenses(),
      summary:    this.expenseService.getSummary(this.selectedMonth, this.selectedYear),
    }).pipe(takeUntil(this.destroy$)).subscribe(({ salary, fixed, summary }) => {
      this.salaryForm.patchValue(
        { priyaSalary: Number(salary.priyaSalary), vamsiSalary: Number(salary.vamsiSalary) },
        { emitEvent: false },
      );
      this.fixedExpenses = fixed;
      this.summary       = summary;
      this.buildPieChart();
    });
  }

  private buildPieChart() {
    // Merge variable + fixed expenses by category, excluding income/credit categories
    const breakdown: Record<string, number> = {};

    for (const [cat, amount] of Object.entries(this.summary?.categoryBreakdown ?? {})) {
      if (!this.expenseService.getCategoryByValue(cat)?.isIncome) {
        breakdown[cat] = (breakdown[cat] ?? 0) + Number(amount);
      }
    }
    for (const fe of this.fixedExpenses) {
      if (!this.expenseService.getCategoryByValue(fe.category)?.isIncome) {
        breakdown[fe.category] = (breakdown[fe.category] ?? 0) + Number(fe.amount);
      }
    }

    const total = Object.values(breakdown).reduce((s, a) => s + a, 0);
    if (total === 0) { this.pieSlices = []; return; }

    const cx = 100, cy = 100, r = 80;
    const sorted = Object.entries(breakdown).sort(([, a], [, b]) => b - a);

    if (sorted.length === 1) {
      this.pieSlices = [{
        path: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`,
        color: this.expenseService.getCategoryByValue(sorted[0][0])?.color ?? '#607d8b',
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
        color: this.expenseService.getCategoryByValue(category)?.color ?? '#607d8b',
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

  get fixedTotal(): number {
    return this.fixedExpenses
      .filter(fe => !this.expenseService.getCategoryByValue(fe.category)?.isIncome)
      .reduce((sum, fe) => sum + Number(fe.amount), 0);
  }

  get creditsTotal(): number {
    const breakdown = this.summary?.categoryBreakdown ?? {};
    const variableCredits = Object.entries(breakdown)
      .filter(([cat]) => this.expenseService.getCategoryByValue(cat)?.isIncome)
      .reduce((sum, [, amt]) => sum + Number(amt), 0);
    const fixedCredits = this.fixedExpenses
      .filter(fe => this.expenseService.getCategoryByValue(fe.category)?.isIncome)
      .reduce((sum, fe) => sum + Number(fe.amount), 0);
    return variableCredits + fixedCredits;
  }

  get actualTotal(): number {
    const breakdown = this.summary?.categoryBreakdown ?? {};
    return Object.entries(breakdown)
      .filter(([cat]) => !this.expenseService.getCategoryByValue(cat)?.isIncome)
      .reduce((sum, [, amt]) => sum + Number(amt), 0);
  }

  get combinedTotal(): number {
    return this.actualTotal + this.fixedTotal;
  }

  get savings(): number {
    return this.totalIncome + this.creditsTotal - this.fixedTotal - this.actualTotal;
  }

  formatCompact(amount: number): string {
    return amount.toLocaleString('en-CA', {
      style: 'currency',
      currency: this.settingsService.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  getCategoryLabel(value: string) {
    return this.expenseService.getCategoryByValue(value)?.label ?? value;
  }

  getCategoryIcon(value: string) {
    return this.expenseService.getCategoryByValue(value)?.icon ?? 'more_horiz';
  }

  async testNotification() {
    this.expenseService.sendTestNotification().subscribe({
      next: () => this.snackBar.open('Test notification sent!', 'OK', { duration: 3000 }),
      error: () => this.snackBar.open('Failed to send test notification', 'OK', { duration: 3000 }),
    });
  }

  async toggleNotifications() {
    try {
      if (this.pushService.enabled()) {
        await this.pushService.disable();
        this.snackBar.open('Daily notifications disabled', 'OK', { duration: 3000 });
      } else {
        await this.pushService.enable();
        this.snackBar.open('Daily notifications enabled — you\'ll hear from us at 8 PM!', 'OK', { duration: 4000 });
      }
    } catch (err: any) {
      this.snackBar.open(err.message ?? 'Could not update notification settings', 'OK', { duration: 4000 });
    }
  }
}
