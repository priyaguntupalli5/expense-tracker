import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { IncomeService } from '../../services/income.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { SettingsService } from '../../services/settings.service';
import { FixedExpense, Summary, monthlyEquivalent } from '../../models/expense.model';

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
    CurrencyPipe, FormsModule,
    MatCardModule, MatSelectModule, MatFormFieldModule,
    MatIconModule, MatButtonModule, MatTooltipModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly expenseService = inject(ExpenseService);
  private readonly incomeService  = inject(IncomeService);
  private readonly destroy$       = new Subject<void>();
  readonly pushService    = inject(PushNotificationService);
  readonly settingsService = inject(SettingsService);

  summary: Summary | null = null;
  selectedMonth = new Date().getMonth() + 1;
  selectedYear  = new Date().getFullYear();
  pieSlices: PieSlice[] = [];
  incomeTotal = 0;
  private fixedExpenses: FixedExpense[] = [];

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

  private loadData() {
    forkJoin({
      categories:  this.expenseService.loadCategories(),
      incomeTotal: this.incomeService.getMonthlyTotal(this.selectedMonth, this.selectedYear),
      fixed:       this.expenseService.getFixedExpenses(),
      summary:     this.expenseService.getSummary(this.selectedMonth, this.selectedYear),
    }).pipe(takeUntil(this.destroy$)).subscribe(({ incomeTotal, fixed, summary }) => {
      this.incomeTotal   = incomeTotal;
      this.fixedExpenses = fixed;
      this.summary       = summary;
      this.buildPieChart();
    });
  }

  private buildPieChart() {
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

  get fixedTotal(): number {
    return this.fixedExpenses
      .filter(fe => !this.expenseService.getCategoryByValue(fe.category)?.isIncome)
      .reduce((sum, fe) => sum + monthlyEquivalent(fe), 0);
  }

  get creditsTotal(): number {
    const breakdown = this.summary?.categoryBreakdown ?? {};
    const variableCredits = Object.entries(breakdown)
      .filter(([cat]) => this.expenseService.getCategoryByValue(cat)?.isIncome)
      .reduce((sum, [, amt]) => sum + Number(amt), 0);
    const fixedCredits = this.fixedExpenses
      .filter(fe => this.expenseService.getCategoryByValue(fe.category)?.isIncome)
      .reduce((sum, fe) => sum + monthlyEquivalent(fe), 0);
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
    return this.incomeTotal + this.creditsTotal - this.fixedTotal - this.actualTotal;
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
    this.expenseService.sendTestNotification().subscribe();
  }

  async toggleNotifications() {
    try {
      if (this.pushService.enabled()) {
        await this.pushService.disable();
      } else {
        await this.pushService.enable();
      }
    } catch {}
  }
}
