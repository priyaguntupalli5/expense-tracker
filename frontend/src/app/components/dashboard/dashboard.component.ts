import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { Expense, FixedExpense, Summary, monthlyEquivalent, monthOccurrences } from '../../models/expense.model';

interface PieSlice {
  path: string;
  color: string;
  category: string;
  amount: number;
  percentage: number;
}

interface SubPieSlice {
  path: string;
  color: string;
  label: string;
  amount: number;
  percentage: number;
  isCredit: boolean;
}

interface ExpenseItem {
  id: number;
  title: string;
  amount: number;
  isFixed: boolean;
}

type ViewMode   = 'to-date' | 'end-of-month';
type ChartView  = 'category' | 'label';

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
  private readonly expenseService  = inject(ExpenseService);
  private readonly incomeService   = inject(IncomeService);
  private readonly router          = inject(Router);
  private readonly destroy$        = new Subject<void>();
  readonly pushService    = inject(PushNotificationService);
  readonly settingsService = inject(SettingsService);

  summary: Summary | null = null;
  selectedMonth = new Date().getMonth() + 1;
  selectedYear  = new Date().getFullYear();
  viewMode: ViewMode = 'to-date';
  pieSlices: PieSlice[] = [];
  incomeTotal = 0;
  private fixedExpenses: FixedExpense[] = [];
  private allExpenses: Expense[] = [];

  chartView: ChartView = 'category';

  drillDownCategory: string | null = null;
  subPieSlices: SubPieSlice[] = [];
  subPieTotal = 0;

  availableLabels: string[] = [];
  selectedLabel: string | null = null;
  labelCategorySlices: PieSlice[] = [];
  labelDrillCategory: string | null = null;
  labelCategorySubSlices: SubPieSlice[] = [];
  labelCategorySubTotal = 0;

  itemsPopupOpen = false;
  popupSubcategory = '';
  popupItems: ExpenseItem[] = [];

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
    this.clearDrillDown();
    this.expenseService.setPeriod(this.selectedMonth, this.selectedYear);
    this.loadData();
  }

  setViewMode(mode: ViewMode) {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.clearDrillDown();
    this.loadData();
  }

  onSliceClick(category: string) {
    if (this.drillDownCategory === category) {
      this.clearDrillDown();
    } else {
      this.drillDownCategory = category;
      this.buildSubPieChart(category);
    }
  }

  setChartView(view: ChartView) {
    if (this.chartView === view) return;
    this.chartView = view;
    this.clearDrillDown();
    if (view === 'label') this.computeAvailableLabels();
  }

  clearDrillDown() {
    this.drillDownCategory = null;
    this.subPieSlices = [];
    this.subPieTotal = 0;
    this.selectedLabel = null;
    this.labelCategorySlices = [];
    this.labelDrillCategory = null;
    this.labelCategorySubSlices = [];
    this.labelCategorySubTotal = 0;
  }

  get labelCategoryTotal(): number {
    return this.labelCategorySlices.reduce((s, sl) => s + sl.amount, 0);
  }

  onSubSliceClick(subcategory: string) {
    const cat = this.drillDownCategory!;
    const items: ExpenseItem[] = [];

    for (const e of this.allExpenses.filter(e => e.category === cat)) {
      if ((e.subcategory || 'Other') === subcategory) {
        items.push({ id: e.id!, title: e.title, amount: Number(e.amount), isFixed: false });
      }
    }
    for (const fe of this.fixedExpenses.filter(fe => fe.category === cat)) {
      if ((fe.subcategory || 'Other') === subcategory) {
        items.push({ id: fe.id!, title: fe.title, amount: this.fixedAmount(fe), isFixed: true });
      }
    }

    if (items.length === 1) {
      this.navigateToItem(items[0]);
    } else {
      this.popupSubcategory = subcategory;
      this.popupItems = items;
      this.itemsPopupOpen = true;
    }
  }

  onLabelSelect(tag: string | null) {
    this.selectedLabel = tag;
    this.labelDrillCategory = null;
    this.labelCategorySubSlices = [];
    this.labelCategorySubTotal = 0;
    if (tag) this.buildLabelCategoryChart(tag);
    else this.labelCategorySlices = [];
  }

  onLabelCategorySliceClick(category: string) {
    if (this.labelDrillCategory === category) {
      this.labelDrillCategory = null;
      this.labelCategorySubSlices = [];
      this.labelCategorySubTotal = 0;
    } else {
      this.labelDrillCategory = category;
      this.buildLabelCategorySubChart(this.selectedLabel!, category);
    }
  }

  onLabelCategorySubSliceClick(subcategory: string) {
    const tag      = this.selectedLabel!;
    const category = this.labelDrillCategory!;
    const items: ExpenseItem[] = this.allExpenses
      .filter(e => (e.tags ?? []).includes(tag) && e.category === category && (e.subcategory || 'Other') === subcategory)
      .map(e => ({ id: e.id!, title: e.title, amount: Number(e.amount), isFixed: false }));

    if (items.length === 1) {
      this.navigateToItem(items[0]);
    } else {
      this.popupSubcategory = subcategory;
      this.popupItems = items;
      this.itemsPopupOpen = true;
    }
  }

  onItemClick(item: ExpenseItem) {
    this.itemsPopupOpen = false;
    this.navigateToItem(item);
  }

  private navigateToItem(item: ExpenseItem) {
    const m = String(this.selectedMonth).padStart(2, '0');

    if (item.isFixed) {
      this.router.navigate(['/fixed-expenses'], {
        queryParams: { highlightId: item.id },
      });
    } else {
      const lastDay = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
      this.router.navigate(['/expenses'], {
        queryParams: {
          highlightId: item.id,
          startDate:   `${this.selectedYear}-${m}-01`,
          endDate:     `${this.selectedYear}-${m}-${String(lastDay).padStart(2, '0')}`,
        },
      });
    }
  }

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
    if (this.viewMode === 'to-date' && this.isFuturePeriod) {
      this.incomeTotal   = 0;
      this.fixedExpenses = [];
      this.summary       = { total: 0, count: 0, categoryBreakdown: {}, subcategoryBreakdown: {}, titleBreakdown: {} };
      this.pieSlices     = [];
      this.availableLabels = [];
      if (this.drillDownCategory) this.buildSubPieChart(this.drillDownCategory);
      if (this.selectedLabel) this.buildLabelCategoryChart(this.selectedLabel);
      return;
    }

    const toDate = this.toDateParam;
    const m = String(this.selectedMonth).padStart(2, '0');
    const expensesObs = toDate
      ? this.expenseService.getByDateRange(`${this.selectedYear}-${m}-01`, toDate)
      : this.expenseService.getAll(this.selectedMonth, this.selectedYear);

    forkJoin({
      categories:  this.expenseService.loadCategories(),
      incomeTotal: this.incomeService.getMonthlyTotal(this.selectedMonth, this.selectedYear, toDate),
      fixed:       this.expenseService.getFixedExpenses(),
      summary:     this.expenseService.getSummary(this.selectedMonth, this.selectedYear, toDate),
      expenses:    expensesObs,
    }).pipe(takeUntil(this.destroy$)).subscribe(({ incomeTotal, fixed, summary, expenses }) => {
      this.incomeTotal   = incomeTotal;
      this.fixedExpenses = fixed;
      this.summary       = summary;
      this.allExpenses   = expenses;
      this.buildPieChart();
      this.computeAvailableLabels();
      if (this.drillDownCategory) this.buildSubPieChart(this.drillDownCategory);
      if (this.selectedLabel) this.buildLabelCategoryChart(this.selectedLabel);
      if (this.labelDrillCategory) this.buildLabelCategorySubChart(this.selectedLabel!, this.labelDrillCategory);
    });
  }

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

  private isRefund(subcategory?: string): boolean {
    return (subcategory ?? '').toLowerCase().trim() === 'refunds & credits';
  }

  private computeAvailableLabels() {
    const tags = new Set<string>();
    for (const e of this.allExpenses) for (const t of (e.tags ?? [])) tags.add(t);
    this.availableLabels = [...tags].sort();
    if (this.selectedLabel && !tags.has(this.selectedLabel)) this.onLabelSelect(null);
    if (!this.selectedLabel && this.availableLabels.length === 1) this.onLabelSelect(this.availableLabels[0]);
  }

  private buildLabelCategoryChart(tag: string) {
    const breakdown: Record<string, number> = {};
    for (const e of this.allExpenses) {
      if (!(e.tags ?? []).includes(tag)) continue;
      if (this.expenseService.getCategoryByValue(e.category)?.isIncome) continue;
      breakdown[e.category] = (breakdown[e.category] ?? 0) +
        (this.isRefund(e.subcategory) ? -Number(e.amount) : Number(e.amount));
    }
    this.labelCategorySlices = this.buildCategoryPieSlices(breakdown);
  }

  private buildLabelCategorySubChart(tag: string, category: string) {
    const breakdown: Record<string, number> = {};
    for (const e of this.allExpenses) {
      if (!(e.tags ?? []).includes(tag) || e.category !== category) continue;
      const sub = e.subcategory || 'Other';
      breakdown[sub] = (breakdown[sub] ?? 0) + Number(e.amount);
    }
    const { slices, total } = this.buildSlices(breakdown, category);
    this.labelCategorySubSlices = slices;
    this.labelCategorySubTotal  = total;
  }

  private buildPieChart() {
    const breakdown: Record<string, number> = {};

    for (const e of this.allExpenses) {
      if (this.expenseService.getCategoryByValue(e.category)?.isIncome) continue;
      breakdown[e.category] = (breakdown[e.category] ?? 0) +
        (this.isRefund(e.subcategory) ? -Number(e.amount) : Number(e.amount));
    }
    for (const fe of this.fixedExpenses) {
      if (this.expenseService.getCategoryByValue(fe.category)?.isIncome) continue;
      breakdown[fe.category] = (breakdown[fe.category] ?? 0) +
        (this.isRefund(fe.subcategory) ? -this.fixedAmount(fe) : this.fixedAmount(fe));
    }

    this.pieSlices = this.buildCategoryPieSlices(breakdown);
  }

  // Builds a top-level pie (by category or by tag) from a { key: amount } breakdown.
  private buildCategoryPieSlices(breakdown: Record<string, number>): PieSlice[] {
    const total = Object.values(breakdown).reduce((s, a) => s + a, 0);
    if (total === 0) return [];

    const cx = 100, cy = 100, r = 80;
    const sorted = Object.entries(breakdown).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
    if (sorted.length === 0) return [];

    if (sorted.length === 1) {
      return [{
        path: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`,
        color: this.getCategoryColor(sorted[0][0]),
        category: sorted[0][0],
        amount: sorted[0][1],
        percentage: 100,
      }];
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
        color: this.getCategoryColor(category),
        category,
        amount,
        percentage: Math.round((amount / total) * 100),
      });

      angle = endAngle;
    }

    return slices;
  }

  private buildSubPieChart(category: string) {
    const breakdown: Record<string, number> = {};

    for (const e of this.allExpenses.filter(e => e.category === category)) {
      const sub = e.subcategory || 'Other';
      breakdown[sub] = (breakdown[sub] ?? 0) + Number(e.amount);
    }
    for (const fe of this.fixedExpenses.filter(f => f.category === category)) {
      const sub = fe.subcategory || 'Other';
      breakdown[sub] = (breakdown[sub] ?? 0) + this.fixedAmount(fe);
    }

    const { slices, total } = this.buildSlices(breakdown, category);
    this.subPieSlices = slices;
    this.subPieTotal  = total;
  }

  private buildSlices(breakdown: Record<string, number>, category: string): { slices: SubPieSlice[]; total: number } {
    const entries = Object.entries(breakdown).filter(([, v]) => v > 0);
    if (entries.length === 0) return { slices: [], total: 0 };

    const CREDIT_COLOR = '#2e7d32';
    const nonCreditEntries = entries.filter(([label]) => !this.isRefund(label));
    const baseColor = this.expenseService.getCategoryByValue(category)?.color ?? '#607d8b';
    const colors = this.generateSubColors(baseColor, nonCreditEntries.length);

    const total = entries.reduce((s, [, v]) => s + v, 0);

    // credit slices sorted last so they appear at the end of the pie
    const sorted = [
      ...nonCreditEntries.sort(([, a], [, b]) => b - a),
      ...entries.filter(([label]) => this.isRefund(label)),
    ];
    const cx = 100, cy = 100, r = 80;

    if (sorted.length === 1) {
      const isCredit = this.isRefund(sorted[0][0]);
      return { total, slices: [{
        path: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`,
        color: isCredit ? CREDIT_COLOR : colors[0],
        label: sorted[0][0],
        amount: sorted[0][1],
        percentage: 100,
        isCredit,
      }] };
    }

    const slices: SubPieSlice[] = [];
    let angle = -Math.PI / 2;
    let colorIdx = 0;

    for (const [label, amount] of sorted) {
      const isCredit = this.isRefund(label);
      const sweep    = (amount / total) * 2 * Math.PI;
      const x1       = cx + r * Math.cos(angle);
      const y1       = cy + r * Math.sin(angle);
      const endAngle = angle + sweep;
      const x2       = cx + r * Math.cos(endAngle);
      const y2       = cy + r * Math.sin(endAngle);

      slices.push({
        path: `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
        color: isCredit ? CREDIT_COLOR : colors[colorIdx++],
        label,
        amount,
        percentage: Math.round((amount / total) * 100),
        isCredit,
      });

      angle = endAngle;
    }

    return { slices, total };
  }

  // Generates N shades of a base hex color by varying lightness in HSL space.
  private generateSubColors(baseHex: string, count: number): string[] {
    if (count === 0) return [];

    const r = parseInt(baseHex.slice(1, 3), 16) / 255;
    const g = parseInt(baseHex.slice(3, 5), 16) / 255;
    const b = parseInt(baseHex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l0 = (max + min) / 2;
    const s0 = d === 0 ? 0 : d / (1 - Math.abs(2 * l0 - 1));
    let h0 = 0;
    if (d !== 0) {
      switch (max) {
        case r: h0 = (((g - b) / d) % 6 + 6) % 6; break;
        case g: h0 = (b - r) / d + 2; break;
        case b: h0 = (r - g) / d + 4; break;
      }
      h0 /= 6;
    }

    return Array.from({ length: count }, (_, i) => {
      const t  = count === 1 ? 0.5 : i / (count - 1);
      const newH = (h0 + t * (25 / 360)) % 1;
      const newL = 0.30 + t * 0.38;
      const newS = Math.min(1, Math.max(0.45, s0));
      return this.hslToHex(newH, newS, newL);
    });
  }

  private hslToHex(h: number, s: number, l: number): string {
    const c  = (1 - Math.abs(2 * l - 1)) * s;
    const x  = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m  = l - c / 2;
    let r1 = 0, g1 = 0, b1 = 0;
    if      (h < 1/6) { r1 = c; g1 = x; }
    else if (h < 2/6) { r1 = x; g1 = c; }
    else if (h < 3/6) { g1 = c; b1 = x; }
    else if (h < 4/6) { g1 = x; b1 = c; }
    else if (h < 5/6) { r1 = x; b1 = c; }
    else              { r1 = c; b1 = x; }
    const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
  }

  get fixedTotal(): number {
    return this.fixedExpenses
      .filter(fe => !this.expenseService.getCategoryByValue(fe.category)?.isIncome)
      .reduce((sum, fe) => sum + this.fixedAmount(fe), 0);
  }

  get actualTotal(): number {
    return this.allExpenses.reduce((sum, e) => {
      if (this.expenseService.getCategoryByValue(e.category)?.isIncome) return sum - Number(e.amount);
      if (this.isRefund(e.subcategory)) return sum - Number(e.amount);
      return sum + Number(e.amount);
    }, 0);
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

  getCategoryColor(value: string) {
    return this.expenseService.getCategoryByValue(value)?.color ?? '#607d8b';
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
