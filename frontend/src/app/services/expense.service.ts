import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { Expense, FixedExpense, MonthlySalary, Summary } from '../models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly storageKey = 'expense-tracker-expenses';
  private readonly fixedKey   = 'expense-tracker-fixed';
  private readonly refreshSubject = new Subject<void>();
  readonly onRefresh$ = this.refreshSubject.asObservable();

  private readonly periodSubject = new BehaviorSubject<{ month: number; year: number }>({
    month: new Date().getMonth() + 1,
    year:  new Date().getFullYear(),
  });
  readonly period$ = this.periodSubject.asObservable();

  get currentPeriod() {
    return this.periodSubject.value;
  }

  setPeriod(month: number, year: number) {
    this.periodSubject.next({ month, year });
  }

  notifyRefresh() {
    this.refreshSubject.next();
  }

  // ── Actual Expenses ────────────────────────────────────────────────────────

  getAll(month?: number, year?: number): Observable<Expense[]> {
    const filtered = this.readExpenses().filter(e => {
      if (month !== undefined && year !== undefined) {
        const d = new Date(e.date);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      }
      return true;
    });
    return of(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }

  getSummary(month?: number, year?: number): Observable<Summary> {
    const expenses = this.readExpenses().filter(e => {
      if (month !== undefined && year !== undefined) {
        const d = new Date(e.date);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      }
      return true;
    });

    const breakdown: Record<string, number> = {};
    let total = 0;
    expenses.forEach(e => {
      const v = Number(e.amount) || 0;
      total += v;
      breakdown[e.category] = (breakdown[e.category] || 0) + v;
    });

    return of({ total, count: expenses.length, categoryBreakdown: breakdown });
  }

  create(expense: Expense): Observable<Expense> {
    const expenses = this.readExpenses();
    const newExpense = { ...expense, id: this.nextId(expenses) };
    this.saveExpenses([...expenses, newExpense]);
    return of(newExpense);
  }

  update(id: number, expense: Expense): Observable<Expense> {
    const expenses = this.readExpenses();
    const index = expenses.findIndex(e => e.id === id);
    if (index >= 0) {
      expenses[index] = { ...expense, id };
      this.saveExpenses(expenses);
      return of(expenses[index]);
    }
    return of(expense);
  }

  delete(id: number): Observable<void> {
    this.saveExpenses(this.readExpenses().filter(e => e.id !== id));
    return of(void 0);
  }

  // ── Fixed Expenses ─────────────────────────────────────────────────────────

  getFixedExpenses(): FixedExpense[] {
    try {
      const stored = localStorage.getItem(this.fixedKey);
      return stored ? (JSON.parse(stored) as FixedExpense[]) : [];
    } catch {
      return [];
    }
  }

  createFixedExpense(expense: FixedExpense): FixedExpense {
    const expenses = this.getFixedExpenses();
    const newExpense = { ...expense, id: this.nextId(expenses) };
    localStorage.setItem(this.fixedKey, JSON.stringify([...expenses, newExpense]));
    return newExpense;
  }

  updateFixedExpense(id: number, expense: FixedExpense): void {
    const expenses = this.getFixedExpenses();
    const index = expenses.findIndex(e => e.id === id);
    if (index >= 0) {
      expenses[index] = { ...expense, id };
      localStorage.setItem(this.fixedKey, JSON.stringify(expenses));
    }
  }

  deleteFixedExpense(id: number): void {
    const expenses = this.getFixedExpenses().filter(e => e.id !== id);
    localStorage.setItem(this.fixedKey, JSON.stringify(expenses));
  }

  // ── Monthly Salary ─────────────────────────────────────────────────────────

  getSalary(month: number, year: number): MonthlySalary {
    try {
      const stored = localStorage.getItem(`salary-${year}-${month}`);
      return stored ? (JSON.parse(stored) as MonthlySalary) : { priyaSalary: 0, vamsiSalary: 0 };
    } catch {
      return { priyaSalary: 0, vamsiSalary: 0 };
    }
  }

  setSalary(month: number, year: number, salary: MonthlySalary): void {
    localStorage.setItem(`salary-${year}-${month}`, JSON.stringify(salary));
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private readExpenses(): Expense[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? (JSON.parse(stored) as Expense[]) : [];
    } catch {
      return [];
    }
  }

  private saveExpenses(expenses: Expense[]) {
    localStorage.setItem(this.storageKey, JSON.stringify(expenses));
  }

  private nextId(items: { id?: number }[]): number {
    return items.length ? Math.max(...items.map(e => e.id ?? 0)) + 1 : 1;
  }
}
