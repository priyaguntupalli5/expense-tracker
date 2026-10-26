import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { IncomeService } from '../../services/income.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { SettingsService } from '../../services/settings.service';
import { ReportService } from '../../services/report.service';
import { Expense, FixedExpense, Summary, monthlyEquivalent, monthOccurrences } from '../../models/expense.model';

interface PieSlice {
  path: string;
  color: string;
  category: string;
  amount: number;
  percentage: number;
  isCredit?: boolean; // the "Refunds & Credits" legend row — no arc, shown green with a "+"
}

const CREDIT_COLOR = '#2e7d32';
const CREDITS_ROW  = '__refunds_credits__';

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
  isCredit?: boolean; // refund / credit — shown green with a "+" in the items popup
}

type ViewMode   = 'to-date' | 'end-of-month';
type ChartView  = 'category' | 'label';

@Component({
  selector: 'app-dashboard',
  imports: [
    CurrencyPipe, FormsModule, RouterLink,
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
  private readonly reportService = inject(ReportService);
  private readonly snackBar      = inject(MatSnackBar);
  downloadingReport = false;

  summary: Summary | null = null;
  selectedMonth = new Date().getMonth() + 1;
  selectedYear  = new Date().getFullYear();
  viewMode: ViewMode = 'to-date';
  pieSlices: PieSlice[] = [];
  incomeTotal = 0;
  private fixedExpenses: FixedExpense[] = [];
  // Materialized fixed-expense occurrences (real, persisted `expenses` rows,
  // tagged with sourceFixedId) for the selected past/current month — the
  // source of truth for that month's Fixed total, so deleting a template
  // later doesn't erase history that already happened. Only future months
  // (which RecurringJobService hasn't materialized yet) fall back to
  // projecting live from `fixedExpenses` via fixedAmount()/monthOccurrences.
  private fixedEntries: Expense[] = [];
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

  // Draggable split between a main pie panel and its drill-down panel, shared
  // across the category and label views since only one is ever shown at once.
  splitRatio = 65;
  isResizingSplit = false;

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

  downloadReport() {
    this.downloadingReport = true;
    const label = `${this.months[this.selectedMonth - 1].label} ${this.selectedYear}`;
    this.reportService.downloadMonthlyReport(this.selectedMonth, this.selectedYear).subscribe({
      next: rows => {
        this.downloadingReport = false;
        if (rows === 0) this.snackBar.open(`No expenses in ${label} — downloaded an empty report.`, 'OK', { duration: 4000 });
      },
      error: () => {
        this.downloadingReport = false;
        this.snackBar.open('Could not create the report. Please try again.', 'OK', { duration: 4000 });
      },
    });
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

  // Net of refunds: category rows are what was spent, the credits row is subtracted
  get labelCategoryTotal(): number {
    return this.labelCategorySlices.reduce((s, sl) => s + (sl.isCredit ? -sl.amount : sl.amount), 0);
  }

  get isDrillDownOpen(): boolean {
    return !!this.drillDownCategory || !!this.labelDrillCategory;
  }

  get mainPanelBasis(): string {
    return this.isDrillDownOpen ? `calc(${this.splitRatio}% - 5px)` : '100%';
  }

  get drillPanelBasis(): string {
    return `calc(${100 - this.splitRatio}% - 5px)`;
  }

  startResize(event: MouseEvent) {
    event.preventDefault();
    const container = (event.currentTarget as HTMLElement).parentElement;
    if (!container) return;

    const containerWidth = container.getBoundingClientRect().width;
    const startX     = event.clientX;
    const startRatio = this.splitRatio;
    this.isResizingSplit = true;

    const onMouseMove = (e: MouseEvent) => {
      const deltaPct = ((e.clientX - startX) / containerWidth) * 100;
      this.splitRatio = Math.min(80, Math.max(25, startRatio + deltaPct));
    };
    const onMouseUp = () => {
      this.isResizingSplit = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  onSubSliceClick(subcategory: string) {
    const cat = this.drillDownCategory!;
    if (cat === CREDITS_ROW) {
      this.openItems(subcategory, this.creditItems(subcategory));
      return;
    }
    const items: ExpenseItem[] = [];

    for (const e of this.allExpenses.filter(e => e.category === cat)) {
      if ((e.subcategory || 'Other') === subcategory) {
        items.push({ id: e.id!, title: e.title, amount: Number(e.amount), isFixed: false });
      }
    }
    for (const fe of this.fixedExpenses.filter(fe => fe.category === cat)) {
      if ((fe.subcategory || 'Other') === subcategory) {
        const amount = this.fixedAmount(fe);
        // Skip fixed expenses not charged this month (not started yet, already ended, off-cycle)
        if (amount !== 0) items.push({ id: fe.id!, title: fe.title, amount, isFixed: true });
      }
    }

    // A "Refunds & Credits" subcategory inside a regular category: every item in it is money back
    this.openItems(subcategory, this.isRefund(subcategory) ? items.map(i => ({ ...i, isCredit: true })) : items);
  }

  // One item: go straight to it. Several: list them in the popup.
  private openItems(title: string, items: ExpenseItem[]) {
    if (items.length === 1) {
      this.navigateToItem(items[0]);
    } else {
      this.popupSubcategory = title;
      this.popupItems = items;
      this.itemsPopupOpen = true;
    }
  }

  // Refunds & credits in the current view whose drill-down group is `key` (optionally one label only)
  private creditItems(key: string, tag?: string): ExpenseItem[] {
    const items: ExpenseItem[] = this.allExpenses
      .filter(e => (!tag || (e.tags ?? []).includes(tag))
                && this.isCredit(e.category, e.subcategory)
                && this.creditKey(e.category, e.subcategory) === key)
      .map(e => ({ id: e.id!, title: e.title, amount: Number(e.amount), isFixed: false, isCredit: true }));
    if (!tag) {
      for (const fe of this.fixedExpenses) {
        if (!this.isCredit(fe.category, fe.subcategory) || this.creditKey(fe.category, fe.subcategory) !== key) continue;
        const amount = this.fixedAmount(fe);
        if (amount !== 0) items.push({ id: fe.id!, title: fe.title, amount, isFixed: true, isCredit: true });
      }
    }
    return items;
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
    const items: ExpenseItem[] = category === CREDITS_ROW
      ? this.creditItems(subcategory, tag)
      : this.allExpenses
          .filter(e => (e.tags ?? []).includes(tag) && e.category === category && (e.subcategory || 'Other') === subcategory)
          .map(e => ({ id: e.id!, title: e.title, amount: Number(e.amount), isFixed: false, isCredit: this.isRefund(subcategory) }));

    this.openItems(subcategory, items);
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
      this.fixedEntries  = [];
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
      categories:   this.expenseService.loadCategories(),
      incomeTotal:  this.incomeService.getMonthlyTotal(this.selectedMonth, this.selectedYear, toDate),
      fixed:        this.expenseService.getFixedExpenses(),
      fixedEntries: this.expenseService.getFixedEntries(this.selectedMonth, this.selectedYear),
      summary:      this.expenseService.getSummary(this.selectedMonth, this.selectedYear, toDate),
      expenses:     expensesObs,
    }).pipe(takeUntil(this.destroy$)).subscribe(({ incomeTotal, fixed, fixedEntries, summary, expenses }) => {
      this.incomeTotal   = incomeTotal;
      this.fixedExpenses = fixed;
      this.fixedEntries  = fixedEntries;
      this.summary       = summary;
      this.allExpenses   = expenses;
      this.buildPieChart();
      this.computeAvailableLabels();
      if (this.drillDownCategory) this.buildSubPieChart(this.drillDownCategory);
      if (this.selectedLabel) this.buildLabelCategoryChart(this.selectedLabel);
      if (this.labelDrillCategory) this.buildLabelCategorySubChart(this.selectedLabel!, this.labelDrillCategory);
    });
  }

  // The materialized fixed-expense rows relevant to the current view: trimmed
  // to "up to today" when viewing the current month in to-date mode (since
  // RecurringJobService materializes the whole month regardless of today),
  // otherwise the full month (a past month is entirely "in the past" already).
  private get relevantFixedEntries(): Expense[] {
    const toDate = this.toDateParam;
    return toDate ? this.fixedEntries.filter(e => e.date <= toDate) : this.fixedEntries;
  }

  // A fixed expense's cost for the selected month in to-date mode. Reuses monthOccurrences()
  // (which honours both startDate and endDate) and, for the current month, caps the range at
  // today so only payments that have already happened count.
  private toDateEquivalent(fe: FixedExpense): number {
    if (this.isFuturePeriod) return 0;

    const toDate = this.toDateParam; // set only when viewing the current month
    const range  = toDate
      ? { ...fe, endDate: fe.endDate && fe.endDate < toDate ? fe.endDate : toDate }
      : fe;

    const occ = monthOccurrences(range, this.selectedMonth, this.selectedYear);
    if (occ !== null) return occ * Number(fe.amount);
    // Recurrence can't be pinned to dates (no startDate): estimate past months, skip the current one
    return toDate ? 0 : monthlyEquivalent(fe);
  }

  private fixedAmount(fe: FixedExpense): number {
    if (this.viewMode === 'to-date') return this.toDateEquivalent(fe);
    const occ = monthOccurrences(fe, this.selectedMonth, this.selectedYear);
    return occ !== null ? occ * Number(fe.amount) : monthlyEquivalent(fe);
  }

  private isRefund(subcategory?: string): boolean {
    return (subcategory ?? '').toLowerCase().trim() === 'refunds & credits';
  }

  // Money back: the "Refunds & Credits" category (stored as an income-type category, e.g.
  // Amazon Refund / Store Credit) or a "Refunds & Credits" subcategory under any category.
  private isCredit(category: string, subcategory?: string): boolean {
    return !!this.expenseService.getCategoryByValue(category)?.isIncome || this.isRefund(subcategory);
  }

  // Drill-down group for a credit: its subcategory within the Refunds & Credits category
  // (Amazon Refund, Store Credit…), or the owning category's name for a "Refunds & Credits"
  // subcategory filed elsewhere (e.g. a refund under Vacation & Travel).
  private creditKey(category: string, subcategory?: string): string {
    if (this.expenseService.getCategoryByValue(category)?.isIncome) {
      const sub = subcategory || 'Other';
      return this.isRefund(sub) ? 'Other' : sub; // never collide with buildSlices' refund marker
    }
    return this.getCategoryLabel(category);
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
    let credits = 0;
    for (const e of this.allExpenses) {
      if (!(e.tags ?? []).includes(tag)) continue;
      if (this.isCredit(e.category, e.subcategory)) { credits += Number(e.amount); continue; }
      breakdown[e.category] = (breakdown[e.category] ?? 0) + Number(e.amount);
    }
    this.labelCategorySlices = this.withCreditsRow(this.buildCategoryPieSlices(breakdown), credits);
  }

  private buildLabelCategorySubChart(tag: string, category: string) {
    if (category === CREDITS_ROW) {
      const breakdown: Record<string, number> = {};
      for (const e of this.allExpenses) {
        if (!(e.tags ?? []).includes(tag) || !this.isCredit(e.category, e.subcategory)) continue;
        const key = this.creditKey(e.category, e.subcategory);
        breakdown[key] = (breakdown[key] ?? 0) + Number(e.amount);
      }
      const { slices, total } = this.buildSlices(breakdown, CREDITS_ROW);
      this.labelCategorySubSlices = slices.map(s => ({ ...s, isCredit: true }));
      this.labelCategorySubTotal  = total;
      return;
    }
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

  // Categories show what was spent; refunds & credits are collected into their own green "+" row
  // instead of being silently netted out of each category. Totals (donut centre) remain net.
  private buildPieChart() {
    const breakdown: Record<string, number> = {};
    let credits = 0;
    const add = (category: string, subcategory: string | undefined, amount: number) => {
      if (this.isCredit(category, subcategory)) credits += amount;
      else breakdown[category] = (breakdown[category] ?? 0) + amount;
    };

    for (const e of this.allExpenses) add(e.category, e.subcategory, Number(e.amount));

    if (!this.isFuturePeriod) {
      for (const e of this.relevantFixedEntries) add(e.category, e.subcategory, Number(e.amount));
    } else {
      for (const fe of this.fixedExpenses) add(fe.category, fe.subcategory, this.fixedAmount(fe));
    }

    this.pieSlices = this.withCreditsRow(this.buildCategoryPieSlices(breakdown), credits);
  }

  // Appends the "Refunds & Credits" legend row (no arc — it isn't spending).
  private withCreditsRow(slices: PieSlice[], credits: number): PieSlice[] {
    if (credits <= 0) return slices;
    return [...slices, { path: '', color: CREDIT_COLOR, category: CREDITS_ROW, amount: credits, percentage: 0, isCredit: true }];
  }

  // Builds a top-level pie (by category or by tag) from a { key: amount } breakdown.
  // Entries with no net positive amount (e.g. a category that's pure refunds) still
  // get a legend row — just without a visible arc — so they stay browsable instead
  // of vanishing entirely.
  private buildCategoryPieSlices(breakdown: Record<string, number>): PieSlice[] {
    const entries = Object.entries(breakdown).filter(([, v]) => v !== 0);
    if (entries.length === 0) return [];

    const positive = entries.filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
    const nonPositive = entries.filter(([, v]) => v <= 0).sort(([, a], [, b]) => b - a);
    const positiveTotal = positive.reduce((s, [, v]) => s + v, 0);

    const cx = 100, cy = 100, r = 80;
    const slices: PieSlice[] = [];

    if (positiveTotal > 0 && positive.length === 1) {
      slices.push({
        path: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`,
        color: this.getCategoryColor(positive[0][0]),
        category: positive[0][0],
        amount: positive[0][1],
        percentage: 100,
      });
    } else if (positiveTotal > 0) {
      let angle = -Math.PI / 2;
      for (const [category, amount] of positive) {
        const sweep    = (amount / positiveTotal) * 2 * Math.PI;
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
          percentage: Math.round((amount / positiveTotal) * 100),
        });

        angle = endAngle;
      }
    }

    for (const [category, amount] of nonPositive) {
      slices.push({ path: '', color: this.getCategoryColor(category), category, amount, percentage: 0 });
    }

    return slices;
  }

  private buildSubPieChart(category: string) {
    if (category === CREDITS_ROW) { this.buildCreditsSubChart(); return; }
    const breakdown: Record<string, number> = {};

    for (const e of this.allExpenses.filter(e => e.category === category)) {
      const sub = e.subcategory || 'Other';
      breakdown[sub] = (breakdown[sub] ?? 0) + Number(e.amount);
    }

    if (!this.isFuturePeriod) {
      for (const e of this.relevantFixedEntries.filter(e => e.category === category)) {
        const sub = e.subcategory || 'Other';
        breakdown[sub] = (breakdown[sub] ?? 0) + Number(e.amount);
      }
    } else {
      for (const fe of this.fixedExpenses.filter(f => f.category === category)) {
        const sub = fe.subcategory || 'Other';
        breakdown[sub] = (breakdown[sub] ?? 0) + this.fixedAmount(fe);
      }
    }

    const { slices, total } = this.buildSlices(breakdown, category);
    this.subPieSlices = slices;
    this.subPieTotal  = total;
  }

  // What makes up the Refunds & Credits row — same sources as buildPieChart. Every slice is a
  // credit, so the legend rows all get the green background and "+".
  private buildCreditsSubChart() {
    const breakdown: Record<string, number> = {};
    const add = (category: string, subcategory: string | undefined, amount: number) => {
      if (!this.isCredit(category, subcategory)) return;
      const key = this.creditKey(category, subcategory);
      breakdown[key] = (breakdown[key] ?? 0) + amount;
    };

    for (const e of this.allExpenses) add(e.category, e.subcategory, Number(e.amount));
    if (!this.isFuturePeriod) {
      for (const e of this.relevantFixedEntries) add(e.category, e.subcategory, Number(e.amount));
    } else {
      for (const fe of this.fixedExpenses) add(fe.category, fe.subcategory, this.fixedAmount(fe));
    }

    const { slices, total } = this.buildSlices(breakdown, CREDITS_ROW);
    this.subPieSlices = slices.map(s => ({ ...s, isCredit: true }));
    this.subPieTotal  = total;
  }

  private buildSlices(breakdown: Record<string, number>, category: string): { slices: SubPieSlice[]; total: number } {
    const entries = Object.entries(breakdown).filter(([, v]) => v > 0);
    if (entries.length === 0) return { slices: [], total: 0 };

    const nonCreditEntries = entries.filter(([label]) => !this.isRefund(label));
    const baseColor = this.getCategoryColor(category);
    const colors = this.generateSubColors(baseColor, nonCreditEntries.length);

    // Arcs are sized against everything shown; the displayed total is net (credits subtracted)
    const total    = entries.reduce((s, [, v]) => s + v, 0);
    const netTotal = entries.reduce((s, [label, v]) => s + (this.isRefund(label) ? -v : v), 0);

    // credit slices sorted last so they appear at the end of the pie
    const sorted = [
      ...nonCreditEntries.sort(([, a], [, b]) => b - a),
      ...entries.filter(([label]) => this.isRefund(label)),
    ];
    const cx = 100, cy = 100, r = 80;

    if (sorted.length === 1) {
      const isCredit = this.isRefund(sorted[0][0]);
      return { total: netTotal, slices: [{
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

    return { slices, total: netTotal };
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
    if (!this.isFuturePeriod) {
      return this.relevantFixedEntries
        .filter(e => !this.expenseService.getCategoryByValue(e.category)?.isIncome)
        .reduce((sum, e) => sum + Number(e.amount), 0);
    }
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
    if (value === CREDITS_ROW) return 'Refunds & Credits';
    return this.expenseService.getCategoryByValue(value)?.label ?? value;
  }

  getCategoryIcon(value: string) {
    if (value === CREDITS_ROW) return 'savings';
    return this.expenseService.getCategoryByValue(value)?.icon ?? 'more_horiz';
  }

  getCategoryColor(value: string) {
    if (value === CREDITS_ROW) return CREDIT_COLOR;
    return this.expenseService.getCategoryByValue(value)?.color ?? '#607d8b';
  }

  isCreditsRow(value: string | null): boolean {
    return value === CREDITS_ROW;
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
