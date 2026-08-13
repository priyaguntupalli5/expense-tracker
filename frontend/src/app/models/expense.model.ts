export interface Expense {
  id?: number;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
  subcategory?: string;
  imageData?: string;
  sourceFixedId?: number; // set on auto-generated entries from fixed expenses
  tags?: string[];
}

export interface FixedExpense {
  id?: number;
  title: string;
  amount: number;
  category: string;
  notes?: string;
  subcategory?: string;
  recurrence?: string; // WEEKLY | BIWEEKLY | MONTHLY | QUARTERLY | YEARLY
  startDate?: string;  // ISO 'YYYY-MM-DD' — first payment date, anchors auto-generation
}

export function monthlyEquivalent(fe: FixedExpense): number {
  const amount = Number(fe.amount);
  switch (fe.recurrence) {
    case 'WEEKLY':    return amount * 52 / 12;
    case 'BIWEEKLY':  return amount * 26 / 12;
    case 'QUARTERLY': return amount / 3;
    case 'YEARLY':    return amount / 12;
    default:          return amount;
  }
}

/**
 * Returns the exact number of times a fixed expense is paid in a given month.
 * Returns null when startDate is absent and the recurrence is ambiguous.
 */
export function monthOccurrences(fe: FixedExpense, month: number, year: number): number | null {
  const recurrence = fe.recurrence ?? 'MONTHLY';

  if (!fe.startDate) {
    return recurrence === 'MONTHLY' ? 1 : null;
  }

  const sd         = new Date(fe.startDate + 'T00:00:00');
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0);

  if (sd > monthEnd) return 0;

  const MS = 86_400_000;

  switch (recurrence) {
    case 'WEEKLY': {
      let cur = new Date(sd.getTime());
      while (cur < monthStart) cur = new Date(cur.getTime() + 7 * MS);
      let n = 0;
      while (cur <= monthEnd) { n++; cur = new Date(cur.getTime() + 7 * MS); }
      return n;
    }
    case 'BIWEEKLY': {
      let cur = new Date(sd.getTime());
      while (cur < monthStart) cur = new Date(cur.getTime() + 14 * MS);
      let n = 0;
      while (cur <= monthEnd) { n++; cur = new Date(cur.getTime() + 14 * MS); }
      return n;
    }
    case 'MONTHLY': {
      const dom = sd.getDate();
      const d   = new Date(year, month - 1, Math.min(dom, monthEnd.getDate()));
      return d >= sd ? 1 : 0;
    }
    case 'QUARTERLY': {
      const startMon  = sd.getMonth() + 1;
      const monthDiff = ((month - startMon) % 12 + 12) % 12;
      if (monthDiff % 3 !== 0) return 0;
      const dom = sd.getDate();
      const d   = new Date(year, month - 1, Math.min(dom, monthEnd.getDate()));
      return d >= sd ? 1 : 0;
    }
    case 'YEARLY': {
      if ((sd.getMonth() + 1) !== month) return 0;
      const dom = sd.getDate();
      const d   = new Date(year, month - 1, Math.min(dom, monthEnd.getDate()));
      return d >= sd ? 1 : 0;
    }
    default:
      return 1;
  }
}

export interface Income {
  id?: number;
  title: string;
  amount: number;
  sourceType: string; // SALARY | BONUS | INVESTMENT | FREELANCE | RENTAL | OTHER
  paymentDate?: string; // ISO 'YYYY-MM-DD' — actual date for non-template entries
  notes?: string;
  // recurrence (templates only)
  recurrence?: string;  // WEEKLY | BIWEEKLY | MONTHLY | QUARTERLY | YEARLY
  startDate?: string;   // ISO 'YYYY-MM-DD' — first payment date, anchors the schedule
  isTemplate?: boolean;
  templateId?: number;
}

// CASH or INVESTMENT — lives on the entry, not the account, so one account can hold both
export type AssetType = 'CASH' | 'INVESTMENT';

export interface BankAccount {
  id?: number;
  ownerName: string;
  accountName: string;
  openingBalance?: number;
  tags?: string[];
}

export interface SavingsEntry {
  id?: number;
  bankAccountId: number;
  month: number;
  year: number;
  amount: number;
  assetType?: AssetType;
  isTransfer?: boolean;
  isOpeningBalance?: boolean;
  linkedEntryId?: number;
  note?: string;
}

export interface SavingsBalance {
  bankAccountId: number;
  tillDate: number;
  thisMonth: number;
  cashTillDate: number;
  investmentTillDate: number;
  cashThisMonth: number;
  investmentThisMonth: number;
}

export interface TransferRequest {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  assetType?: AssetType;
  month: number;
  year: number;
  note?: string;
}

export interface Subcategory {
  id: number;
  categoryValue: string;
  name: string;
  isShared?: boolean;
}

export interface Category {
  id?: number;
  value: string;
  label: string;
  icon: string;
  color: string;
  isIncome?: boolean;
  isShared?: boolean;
}

export interface Summary {
  total: number;
  count: number;
  categoryBreakdown: Record<string, number>;
  subcategoryBreakdown: Record<string, Record<string, number>>;
  titleBreakdown: Record<string, Record<string, number>>;
}

export const CATEGORIES = [
  { value: 'FOOD',          label: 'Food',          icon: 'restaurant' },
  { value: 'TRANSPORT',     label: 'Transport',      icon: 'directions_car' },
  { value: 'HOUSING',       label: 'Housing',        icon: 'home' },
  { value: 'ENTERTAINMENT', label: 'Entertainment',  icon: 'movie' },
  { value: 'HEALTH',        label: 'Health',         icon: 'local_hospital' },
  { value: 'SHOPPING',      label: 'Shopping',       icon: 'shopping_cart' },
  { value: 'EDUCATION',     label: 'Education',      icon: 'school' },
  { value: 'OTHER',         label: 'Other',          icon: 'more_horiz' },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  FOOD:          '#e91e63',
  TRANSPORT:     '#2196f3',
  HOUSING:       '#ff9800',
  ENTERTAINMENT: '#9c27b0',
  HEALTH:        '#4caf50',
  SHOPPING:      '#00bcd4',
  EDUCATION:     '#ff5722',
  OTHER:         '#607d8b',
};
