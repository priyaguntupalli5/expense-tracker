import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, catchError, of } from 'rxjs';
import { Expense, FixedExpense, MonthlySalary, Summary } from '../models/expense.model';

const API = 'http://localhost:8080/api';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly http = inject(HttpClient);
  private readonly refreshSubject = new Subject<void>();
  readonly onRefresh$ = this.refreshSubject.asObservable();

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
    return this.http.get<Expense[]>(`${API}/expenses`, { params });
  }

  getSummary(month?: number, year?: number): Observable<Summary> {
    const params: Record<string, string> = {};
    if (month !== undefined) params['month'] = String(month);
    if (year  !== undefined) params['year']  = String(year);
    return this.http.get<Summary>(`${API}/expenses/summary`, { params });
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
    return this.http.get<FixedExpense[]>(`${API}/fixed-expenses`);
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
}
