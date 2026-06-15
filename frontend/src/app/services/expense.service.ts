import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, catchError, map, of, tap } from 'rxjs';
import { Category, Expense, FixedExpense, MonthlySalary, Subcategory, Summary } from '../models/expense.model';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly http = inject(HttpClient);
  private readonly refreshSubject = new Subject<void>();
  readonly onRefresh$ = this.refreshSubject.asObservable();

  private readonly categoriesSubject = new BehaviorSubject<Category[]>([]);
  readonly categories$ = this.categoriesSubject.asObservable();

  get categories(): Category[] { return this.categoriesSubject.value; }

  private readonly periodSubject = new BehaviorSubject<{ month: number; year: number }>({
    month: new Date().getMonth() + 1,
    year:  new Date().getFullYear(),
  });
  readonly period$ = this.periodSubject.asObservable();

  get currentPeriod() { return this.periodSubject.value; }

  setPeriod(month: number, year: number) {
    this.periodSubject.next({ month, year });
  }

  notifyRefresh() {
    this.refreshSubject.next();
  }

  // ── Actual Expenses ────────────────────────────────────────────────────────

  getAll(month?: number, year?: number): Observable<Expense[]> {
    const params: Record<string, string> = {};
    if (month !== undefined) params['month'] = String(month);
    if (year  !== undefined) params['year']  = String(year);
    return this.http.get<Expense[]>(`${API}/expenses`, { params })
      .pipe(catchError(() => of<Expense[]>([])));
  }

  getByDateRange(startDate: string, endDate: string): Observable<Expense[]> {
    return this.http.get<Expense[]>(`${API}/expenses`, { params: { startDate, endDate } })
      .pipe(catchError(() => of<Expense[]>([])));
  }

  getSummary(month?: number, year?: number): Observable<Summary> {
    const params: Record<string, string> = {};
    if (month !== undefined) params['month'] = String(month);
    if (year  !== undefined) params['year']  = String(year);
    return this.http.get<Summary>(`${API}/expenses/summary`, { params })
      .pipe(catchError(() => of<Summary>({ total: 0, count: 0, categoryBreakdown: {} })));
  }

  create(expense: Expense): Observable<Expense> {
    return this.http.post<Expense>(`${API}/expenses`, expense);
  }

  update(id: number, expense: Expense): Observable<Expense> {
    return this.http.put<Expense>(`${API}/expenses/${id}`, expense);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/expenses/${id}`);
  }

  // ── Fixed Expenses ─────────────────────────────────────────────────────────

  getFixedExpenses(): Observable<FixedExpense[]> {
    return this.http.get<FixedExpense[]>(`${API}/fixed-expenses`)
      .pipe(catchError(() => of<FixedExpense[]>([])));
  }

  createFixedExpense(expense: FixedExpense): Observable<FixedExpense> {
    return this.http.post<FixedExpense>(`${API}/fixed-expenses`, expense);
  }

  updateFixedExpense(id: number, expense: FixedExpense): Observable<FixedExpense> {
    return this.http.put<FixedExpense>(`${API}/fixed-expenses/${id}`, expense);
  }

  deleteFixedExpense(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/fixed-expenses/${id}`);
  }

  // ── Monthly Salary ─────────────────────────────────────────────────────────

  getSalary(month: number, year: number): Observable<MonthlySalary> {
    return this.http
      .get<MonthlySalary>(`${API}/salaries`, { params: { month: String(month), year: String(year) } })
      .pipe(catchError(() => of<MonthlySalary>({ priyaSalary: 0, vamsiSalary: 0 })));
  }

  setSalary(month: number, year: number, salary: MonthlySalary): Observable<MonthlySalary> {
    return this.http.post<MonthlySalary>(`${API}/salaries`, {
      month,
      year,
      priyaSalary: salary.priyaSalary,
      vamsiSalary: salary.vamsiSalary,
    });
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  loadCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${API}/categories`).pipe(
      tap(cats => this.categoriesSubject.next(cats)),
      catchError(() => of<Category[]>([])),
    );
  }

  createCategory(category: Omit<Category, 'id' | 'value'>): Observable<Category> {
    return this.http.post<Category>(`${API}/categories`, category).pipe(
      tap(() => this.loadCategories().subscribe()),
    );
  }

  updateCategory(id: number, category: Omit<Category, 'id' | 'value'>): Observable<Category> {
    return this.http.put<Category>(`${API}/categories/${id}`, category).pipe(
      tap(() => this.loadCategories().subscribe()),
    );
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/categories/${id}`).pipe(
      tap(() => this.loadCategories().subscribe()),
    );
  }

  getCategoryByValue(value: string): Category | undefined {
    return this.categoriesSubject.value.find(c => c.value === value);
  }

  // ── Subcategories ──────────────────────────────────────────────────────────

  getSubcategories(categoryValue: string): Observable<string[]> {
    return this.http.get<Subcategory[]>(`${API}/subcategories`, { params: { category: categoryValue } }).pipe(
      map(items => items.map(s => s.name)),
      catchError(() => of<string[]>([])),
    );
  }
}
