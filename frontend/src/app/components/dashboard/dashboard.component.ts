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
import { FixedExpense, Summary, monthlyEquivalent, monthOccurrences } from '../../models/expense.model';

interface PieSlice {
  path: string;
  color: string;
  category: string;
  amount: number;
  percentage: number;
}

type ViewMode = 'to-date' | 'end-of-month';

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
  viewMode: ViewMode = 'to-date';
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

  setViewMode(mode: ViewMode) {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.loadData();
  }

  // Returns today's ISO date when viewing the current month in to-date mode,
  // undefined otherwise (backend returns the full-month result).
  private get toDateParam(): string | undefined {
    if (this.viewMode !== 'to-date') return undefined;
    const now = new Date();
    if (this.selectedYear === now.getFullYear() && this.selectedMonth === now.getMonth() + 1) {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return undefined;
  }

  private get isFuturePeriod(): boolean {
    const now = new Date();
    return this.selectedYear > now.getFullYear() ||
      (this.selectedYear === now.getFullYear() && this.selectedMonth > now.getMonth() + 1);
  }

  private loadData() {
    // Future period in to-date mode → nothing has happened yet
    if (this.viewMode === 'to-date' && this.isFuturePeriod) {
      this.incomeTotal   = 0;
      this.fixedExpenses = [];
      this.summary       = { total: 0, count: 0, categoryBreakdown: {} };
      this.pieSlices     = [];
      return;
    }

    const toDate = this.toDateParam;
    forkJoin({
      categories:  this.expenseService.loadCategories(),
      incomeTotal: this.incomeService.getMonthlyTotal(this.selectedMonth, this.selectedYear, toDate),
      fixed:       this.expenseService.getFixedExpenses(),
      summary:     this.expenseService.getSummary(this.selectedMonth, this.selectedYear, toDate),
    }).pipe(takeUntil(this.destroy$)).subscribe(({ incomeTotal, fixed, summary }) => {
      this.incomeTotal   = incomeTotal;
      this.fixedExpenses = fixed;
      this.summary       = summary;
      this.buildPieChart();
    });
  }

  /**
   * Amount to attribute to a fixed expense in "to-date" mode for the selected month.
   *
   * - Past months:   full monthly equivalent (everything already paid).
   * - Future months: 0.
   * - Current month:
   *     MONTHLY/QUARTERLY — full amount if paymentDay has passed, else 0.
   *     YEARLY            — amount if paymentMonth matches and paymentDay has passed, else 0.
   *     WEEKLY/BIWEEKLY   — count occurrences from start of month up to today × amount.
   */
  private toDateEquivalent(fe: FixedExpense): number {
    const now = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear  = now.getFullYear();

    if (this.selectedYear < thisYear ||
        (this.selectedYear === thisYear && this.selectedMonth < thisMonth)) {
      return monthlyEquivalent(fe);
    }
    if (this.selectedYear > thisYear ||
        (this.selectedYear === thisYear && this.selectedMonth > thisMonth)) {
      return 0;
    }

    const amount    = Number(fe.amount);
    const todayDay  = now.getDate();
    const recurrence = fe.recurrence ?? 'MONTHLY';

    switch (recurrence) {
      case 'MONTHLY': {
        const dom = fe.startDate ? new Date(fe.startDate + 'T00:00:00').getDate() : 1;
        return dom <= todayDay ? amount : 0;
      }

      case 'YEARLY': {
        if (!fe.startDate) return 0;
        const sd = new Date(fe.startDate + 'T00:00:00');
        if ((sd.getMonth() + 1) !== this.selectedMonth) return 0;
        return sd.getDate() <= todayDay ? amount : 0;
      }

      case 'QUARTERLY': {
        if (!fe.startDate) return 0;
        const sd = new Date(fe.startDate + 'T00:00:00');
        const startMonth = sd.getMonth() + 1;
        const monthDiff = ((this.selectedMonth - startMonth) % 12 + 12) % 12;
        if (monthDiff % 3 !== 0) return 0;
        return sd.getDate() <= todayDay ? amount : 0;
      }

      case 'WEEKLY':
      case 'BIWEEKLY': {
        const intervalMs = (recurrence === 'WEEKLY' ? 7 : 14) * 86_400_000;
        const anchor     = fe.startDate
          ? new Date(fe.startDate + 'T00:00:00')
          : new Date(thisYear, thisMonth - 1, 1);
        const monthStart = new Date(thisYear, thisMonth - 1, 1);
        const today      = new Date(thisYear, thisMonth - 1, todayDay);

        // Advance anchor to first occurrence on or after the start of the month
        let cursor = new Date(anchor.getTime());
        while (cursor < monthStart) cursor = new Date(cursor.getTime() + intervalMs);

        let count = 0;
        while (cursor <= today) {
          count++;
          cursor = new Date(cursor.getTime() + intervalMs);
        }
        return count * amount;
      }

      default: {
        const dom = fe.startDate ? new Date(fe.startDate + 'T00:00:00').getDate() : 1;
        return dom <= todayDay ? amount : 0;
      }
    }
  }

  private fixedAmount(fe: FixedExpense): number {
    if (this.viewMode === 'to-date') return this.toDateEquivalent(fe);
    const occ = monthOccurrences(fe, this.selectedMonth, this.selectedYear);
    return occ !== null ? occ * Number(fe.amount) : monthlyEquivalent(fe);
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
        breakdown[fe.category] = (breakdown[fe.category] ?? 0) + this.fixedAmount(fe);
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
      .reduce((sum, fe) => sum + this.fixedAmount(fe), 0);
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
    return this.incomeTotal - this.fixedTotal - this.actualTotal;
  }

  get savingsLabel(): string {
    if (this.savings < 0) return 'Over Budget';
    return this.viewMode === 'to-date' ? 'Savings to Date' : 'Estimated Savings';
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
