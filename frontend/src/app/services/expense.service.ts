import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Expense, Summary } from '../models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/expenses';

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
    let params = new HttpParams();
    if (month !== undefined) params = params.set('month', String(month));
    if (year !== undefined) params = params.set('year', String(year));
    return this.http.get<Expense[]>(this.apiUrl, { params });
  }

  getSummary(month?: number, year?: number): Observable<Summary> {
    let params = new HttpParams();
    if (month !== undefined) params = params.set('month', String(month));
    if (year !== undefined) params = params.set('year', String(year));
    return this.http.get<Summary>(`${this.apiUrl}/summary`, { params });
  }

  create(expense: Expense): Observable<Expense> {
    return this.http.post<Expense>(this.apiUrl, expense);
  }

  update(id: number, expense: Expense): Observable<Expense> {
    return this.http.put<Expense>(`${this.apiUrl}/${id}`, expense);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
