export interface Expense {
  id?: number;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
}

export interface FixedExpense {
  id?: number;
  title: string;
  amount: number;
  category: string;
  notes?: string;
}

export interface MonthlySalary {
  priyaSalary: number;
  vamsiSalary: number;
}

export interface Category {
  id?: number;
  value: string;
  label: string;
  icon: string;
  color: string;
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
