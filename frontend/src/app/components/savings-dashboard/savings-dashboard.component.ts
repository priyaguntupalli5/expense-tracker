import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { SettingsService } from '../../services/settings.service';
import { BankAccount, SavingsBalance } from '../../models/expense.model';

interface AccountRow {
  account: BankAccount;
  tillDate: number;
  thisMonth: number;
  cashTillDate: number;
  investmentTillDate: number;
}

interface OwnerAgg {
  owner: string;
  tillDate: number;
  cashTillDate: number;
  investmentTillDate: number;
}

interface OwnerSlice {
  path: string;
  color: string;
  owner: string;
  amount: number;
  percentage: number;
  cashTillDate: number;
  investmentTillDate: number;
}

interface AccountSlice {
  path: string;
  color: string;
  account: BankAccount;
  amount: number;
  percentage: number;
  cashTillDate: number;
  investmentTillDate: number;
}

// Fixed-order categorical palette (validated for CVD-safe adjacent pairs) —
// assigned by rank, never cycled or reassigned when the owner list changes.
const PALETTE = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
];
const OVERFLOW_COLOR = '#898781'; // muted — used past the 8th owner, folded as "Other"

@Component({
  selector: 'app-savings-dashboard',
  imports: [
    CurrencyPipe, FormsModule, RouterLink,
    MatCardModule, MatIconModule, MatButtonModule, MatSelectModule, MatFormFieldModule, MatTooltipModule,
  ],
  templateUrl: './savings-dashboard.component.html',
  styleUrl: './savings-dashboard.component.scss',
})
export class SavingsDashboardComponent implements OnInit {
  private readonly expenseService = inject(ExpenseService);
  private readonly router         = inject(Router);
  readonly settingsService        = inject(SettingsService);

  rows: AccountRow[] = [];
  ownerSlices: OwnerSlice[] = [];

  drillDownOwner: string | null = null;
  drillDownColor = '#607d8b';
  accountSlices: AccountSlice[] = [];

  chartView: 'owner' | 'label' = 'owner';
  availableLabels: string[] = [];
  selectedLabel: string | null = null;
  labelOwnerSlices: OwnerSlice[] = [];
  labelDrillOwner: string | null = null;
  labelDrillColor = '#607d8b';
  labelAccountSlices: AccountSlice[] = [];

  // Draggable split between the owner pie and the drill-down panel, as a
  // percentage of the row's width given to the owner pie side. Shared across
  // the owner and label views since only one is ever shown at once.
  splitRatio = 65;
  isResizingSplit = false;

  selectedMonth = new Date().getMonth() + 1;
  selectedYear  = new Date().getFullYear();

  readonly months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' },   { value: 4, label: 'April' },
    { value: 5, label: 'May' },     { value: 6, label: 'June' },
    { value: 7, label: 'July' },    { value: 8, label: 'August' },
    { value: 9, label: 'September' },{ value: 10,label: 'October' },
    { value: 11,label: 'November' },{ value: 12,label: 'December' },
  ];
  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  ngOnInit() {
    this.load();
  }

  onPeriodChange() {
    this.clearDrillDown();
    this.clearLabelDrillDown();
    this.load();
  }

  setChartView(view: 'owner' | 'label') {
    if (this.chartView === view) return;
    this.chartView = view;
    this.clearDrillDown();
    this.clearLabelDrillDown();
    if (view === 'label') this.computeAvailableLabels();
  }

  private load() {
    forkJoin([
      this.expenseService.getBankAccounts(),
      this.expenseService.getSavingsBalances(this.selectedMonth, this.selectedYear),
    ]).subscribe(([accounts, balances]) => {
      this.rows = accounts.map(account => {
        const balance = balances.find((b: SavingsBalance) => b.bankAccountId === account.id);
        const opening = Number(account.openingBalance || 0);
        return {
          account,
          tillDate:            balance ? Number(balance.tillDate) : opening,
          thisMonth:           balance ? Number(balance.thisMonth) : 0,
          cashTillDate:        balance ? Number(balance.cashTillDate) : opening,
          investmentTillDate:  balance ? Number(balance.investmentTillDate) : 0,
        };
      });
      this.buildOwnerPieChart();
      if (this.drillDownOwner) this.buildAccountPieChart(this.drillDownOwner, this.drillDownColor);

      this.computeAvailableLabels();
      if (this.selectedLabel) this.onLabelSelect(this.selectedLabel);
    });
  }

  get totalTillDate(): number {
    return this.rows.reduce((sum, r) => sum + r.tillDate, 0);
  }

  get totalThisMonth(): number {
    return this.rows.reduce((sum, r) => sum + r.thisMonth, 0);
  }

  get ownerCount(): number {
    return new Set(this.rows.map(r => r.account.ownerName)).size;
  }

  get accountSlicesTotal(): number {
    return this.accountSlices.reduce((sum, s) => sum + s.amount, 0);
  }

  get labelOwnerTotal(): number {
    return this.labelOwnerSlices.reduce((sum, s) => sum + s.amount, 0);
  }

  get labelAccountSlicesTotal(): number {
    return this.labelAccountSlices.reduce((sum, s) => sum + s.amount, 0);
  }

  formatCompact(amount: number): string {
    return amount.toLocaleString('en-CA', {
      style: 'currency',
      currency: this.settingsService.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  onOwnerSliceClick(owner: string) {
    if (this.drillDownOwner === owner) {
      this.clearDrillDown();
      return;
    }
    this.drillDownOwner = owner;
    this.drillDownColor = this.ownerSlices.find(s => s.owner === owner)?.color ?? OVERFLOW_COLOR;
    this.buildAccountPieChart(owner, this.drillDownColor);
  }

  clearDrillDown() {
    this.drillDownOwner = null;
    this.accountSlices = [];
  }

  onAccountSliceClick(account: BankAccount) {
    this.router.navigate(['/savings'], { queryParams: { highlightId: account.id } });
  }

  private computeAvailableLabels() {
    const tags = new Set<string>();
    for (const row of this.rows) for (const t of (row.account.tags ?? [])) tags.add(t);
    this.availableLabels = [...tags].sort();
    if (this.selectedLabel && !tags.has(this.selectedLabel)) this.onLabelSelect(null);
    if (!this.selectedLabel && this.availableLabels.length === 1) this.onLabelSelect(this.availableLabels[0]);
  }

  onLabelSelect(tag: string | null) {
    this.selectedLabel = tag;
    this.clearLabelDrillDown();
    this.labelOwnerSlices = tag
      ? this.buildOwnerSlicesFrom(this.rows.filter(r => (r.account.tags ?? []).includes(tag)))
      : [];
  }

  onLabelOwnerSliceClick(owner: string) {
    if (this.labelDrillOwner === owner) {
      this.clearLabelDrillDown();
      return;
    }
    this.labelDrillOwner = owner;
    this.labelDrillColor = this.labelOwnerSlices.find(s => s.owner === owner)?.color ?? OVERFLOW_COLOR;
    const taggedRows = this.rows.filter(r => (r.account.tags ?? []).includes(this.selectedLabel!));
    this.labelAccountSlices = this.buildAccountSlicesFrom(taggedRows, owner, this.labelDrillColor);
  }

  clearLabelDrillDown() {
    this.labelDrillOwner = null;
    this.labelAccountSlices = [];
  }

  get isDrillDownOpen(): boolean {
    return !!this.drillDownOwner || !!this.labelDrillOwner;
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

  private buildOwnerPieChart() {
    this.ownerSlices = this.buildOwnerSlicesFrom(this.rows);
  }

  private buildAccountPieChart(owner: string, baseColor: string) {
    this.accountSlices = this.buildAccountSlicesFrom(this.rows, owner, baseColor);
  }

  // Shared by the owner view and the label view (which just pre-filters rows
  // to accounts carrying the selected label before calling these).
  private buildOwnerSlicesFrom(rows: AccountRow[]): OwnerSlice[] {
    const totals = new Map<string, OwnerAgg>();
    for (const row of rows) {
      const agg = totals.get(row.account.ownerName) ?? {
        owner: row.account.ownerName, tillDate: 0, cashTillDate: 0, investmentTillDate: 0,
      };
      agg.tillDate           += row.tillDate;
      agg.cashTillDate       += row.cashTillDate;
      agg.investmentTillDate += row.investmentTillDate;
      totals.set(row.account.ownerName, agg);
    }

    const built = this.buildSlices([...totals.values()], o => o.tillDate,
      i => i < PALETTE.length ? PALETTE[i] : OVERFLOW_COLOR);

    return built.map(b => ({
      path: b.path, color: b.color, owner: b.item.owner, amount: b.amount, percentage: b.percentage,
      cashTillDate: b.item.cashTillDate, investmentTillDate: b.item.investmentTillDate,
    }));
  }

  private buildAccountSlicesFrom(rows: AccountRow[], owner: string, baseColor: string): AccountSlice[] {
    const items = rows.filter(r => r.account.ownerName === owner);
    const positiveCount = items.filter(r => r.tillDate > 0).length;
    const colors = this.generateSubColors(baseColor, positiveCount);

    const built = this.buildSlices(items, r => r.tillDate, i => colors[i] ?? OVERFLOW_COLOR);

    return built.map(b => ({
      path: b.path, color: b.color, account: b.item.account, amount: b.amount, percentage: b.percentage,
      cashTillDate: b.item.cashTillDate, investmentTillDate: b.item.investmentTillDate,
    }));
  }

  // Builds a donut's worth of slices from any list of amount-bearing items —
  // shared by the owner-level pie and the per-owner account drill-down pie.
  private buildSlices<T>(
    items: T[],
    amountOf: (item: T) => number,
    colorFor: (index: number) => string,
  ): { path: string; color: string; amount: number; percentage: number; item: T }[] {
    const positive    = items.filter(i => amountOf(i) > 0).sort((a, b) => amountOf(b) - amountOf(a));
    const nonPositive = items.filter(i => amountOf(i) <= 0);
    const positiveTotal = positive.reduce((s, i) => s + amountOf(i), 0);

    const cx = 100, cy = 100, r = 80;
    const result: { path: string; color: string; amount: number; percentage: number; item: T }[] = [];

    if (positiveTotal > 0 && positive.length === 1) {
      result.push({
        path: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`,
        color: colorFor(0),
        amount: amountOf(positive[0]),
        percentage: 100,
        item: positive[0],
      });
    } else if (positiveTotal > 0) {
      let angle = -Math.PI / 2;
      positive.forEach((item, i) => {
        const amount   = amountOf(item);
        const sweep    = (amount / positiveTotal) * 2 * Math.PI;
        const x1       = cx + r * Math.cos(angle);
        const y1       = cy + r * Math.sin(angle);
        const endAngle = angle + sweep;
        const x2       = cx + r * Math.cos(endAngle);
        const y2       = cy + r * Math.sin(endAngle);

        result.push({
          path: `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
          color: colorFor(i),
          amount,
          percentage: Math.round((amount / positiveTotal) * 100),
          item,
        });

        angle = endAngle;
      });
    }

    nonPositive.forEach(item => {
      result.push({ path: '', color: OVERFLOW_COLOR, amount: amountOf(item), percentage: 0, item });
    });

    return result;
  }

  // Generates N shades of a base hex color by varying lightness in HSL space —
  // ties each owner's account slices visually back to that owner's pie color.
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
      const t    = count === 1 ? 0.5 : i / (count - 1);
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
}
