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
}

export interface FixedExpense {
  id?: number;
  title: string;
  amount: number;
  category: string;
  notes?: string;
  subcategory?: string;
  recurrence?: string;   // WEEKLY | BIWEEKLY | MONTHLY | QUARTERLY | YEARLY
  paymentDay?: number;   // day-of-month (1-31) or day-of-week (1=Mon..7=Sun)
  paymentMonth?: number; // 1-12, only for YEARLY
  startDate?: string;    // ISO 'YYYY-MM-DD' — anchors auto-generation
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
