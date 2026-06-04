import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { Expense, Summary } from '../models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly storageKey = 'expense-tracker-expenses';
  private readonly refreshSubject = new Subject<void>();
  readonly onRefresh$ = this.refreshSubject.asObservable();

  private readonly periodSubject = new BehaviorSubject<{ month: number; year: number }>({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
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

  getAll(month?: number, year?: number): Observable<Expense[]> {
    const expenses = this.readExpenses();
    const filtered = expenses.filter(expense => {
      if (month !== undefined && year !== undefined) {
        const date = new Date(expense.date);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      }
      return true;
    });
    return of(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }

  getSummary(month?: number, year?: number): Observable<Summary> {
    const expenses = this.readExpenses().filter(expense => {
      if (month !== undefined && year !== undefined) {
        const date = new Date(expense.date);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      }
      return true;
    });

    const breakdown: Record<string, number> = {};
    let total = 0;

    expenses.forEach(expense => {
      const value = Number(expense.amount) || 0;
      total += value;
      breakdown[expense.category] = (breakdown[expense.category] || 0) + value;
    });

    return of({
      total,
      count: expenses.length,
      categoryBreakdown: breakdown,
    });
  }

  create(expense: Expense): Observable<Expense> {
    const expenses = this.readExpenses();
    const nextId = this.getNextId(expenses);
    const newExpense: Expense = { ...expense, id: nextId };
    this.saveExpenses([...expenses, newExpense]);
    return of(newExpense);
  }

  update(id: number, expense: Expense): Observable<Expense> {
    const expenses = this.readExpenses();
    const index = expenses.findIndex(item => item.id === id);
    if (index < 0) {
      return of(expense);
    }
    expenses[index] = { ...expense, id };
    this.saveExpenses(expenses);
    return of(expenses[index]);
  }

  delete(id: number): Observable<void> {
    const expenses = this.readExpenses().filter(item => item.id !== id);
    this.saveExpenses(expenses);
    return of(void 0);
  }

  importCsv(csvText: string): Observable<Expense[]> {
    const imported = this.parseCsv(csvText);
    if (!imported.length) {
      return of([]);
    }
    const expenses = this.readExpenses();
    const startId = this.getNextId(expenses);
    const newExpenses = imported.map((expense, index) => ({ ...expense, id: startId + index }));
    this.saveExpenses([...expenses, ...newExpenses]);
    return of(newExpenses);
  }

  private readExpenses(): Expense[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) as Expense[] : [];
    } catch {
      return [];
    }
  }

  private saveExpenses(expenses: Expense[]) {
    localStorage.setItem(this.storageKey, JSON.stringify(expenses));
  }

  private getNextId(expenses: Expense[]) {
    return expenses.length ? Math.max(...expenses.map(item => item.id ?? 0)) + 1 : 1;
  }

  private parseCsv(csvText: string): Expense[] {
    const lines = csvText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length < 2) {
      return [];
    }

    const headers = this.parseCsvLine(lines[0]);
    const rows = lines.slice(1).map(line => this.parseCsvLine(line));

    const mappedRows = rows
      .map(values => this.buildExpenseFromRow(headers, values))
      .filter((expense): expense is Expense => expense !== null);

    return mappedRows;
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    values.push(current.trim());
    return values;
  }

  private buildExpenseFromRow(headers: string[], values: string[]): Expense | null {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header.toLowerCase()] = values[index] ?? '';
    });

    const title = this.firstValue(row, ['description', 'merchant', 'transaction', 'details', 'title', 'name']);
    const rawAmount = this.firstValue(row, ['amount', 'transaction amount', 'debit', 'credit', 'value']);
    const rawDate = this.firstValue(row, ['date', 'transaction date', 'posted date', 'post date']);
    const rawCategory = this.firstValue(row, ['category', 'tag', 'type']);
    const notes = this.firstValue(row, ['notes', 'memo']);

    const amount = this.parseAmount(rawAmount);
    const date = this.parseDate(rawDate);
    const category = rawCategory && rawCategory.length > 0 ? rawCategory.toUpperCase() : 'OTHER';

    if (!title || amount === null || !date) {
      return null;
    }

    return {
      title,
      amount,
      date,
      category,
      notes: notes || undefined,
    };
  }

  private firstValue(row: Record<string, string>, keys: string[]): string {
    for (const key of keys) {
      if (row[key]) {
        return row[key];
      }
    }
    return '';
  }

  private parseAmount(value: string): number | null {
    if (!value) return null;
    const normalized = value
      .replace(/\(/g, '-')
      .replace(/\)/g, '')
      .replace(/[^0-9.-]/g, '');
    const amount = Number(normalized);
    return Number.isFinite(amount) ? Math.abs(amount) : null;
  }

  private parseDate(value: string): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parts = trimmed.split(/[\/\-\.]/).map(part => part.trim());
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a.length === 4) {
        return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
      }
      return `${c.padStart(4, '0')}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    }
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
