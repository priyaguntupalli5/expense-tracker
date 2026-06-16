import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { Income } from '../models/expense.model';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

export const SOURCE_TYPES = [
  { value: 'SALARY',     label: 'Salary',     icon: 'work',         color: '#2e7d32' },
  { value: 'BONUS',      label: 'Bonus',       icon: 'star',         color: '#1565c0' },
  { value: 'INVESTMENT', label: 'Investment',  icon: 'trending_up',  color: '#6a1b9a' },
  { value: 'FREELANCE',  label: 'Freelance',   icon: 'laptop_mac',   color: '#e65100' },
  { value: 'RENTAL',     label: 'Rental',      icon: 'home_work',    color: '#00695c' },
  { value: 'OTHER',      label: 'Other',       icon: 'more_horiz',   color: '#546e7a' },
] as const;

@Injectable({ providedIn: 'root' })
export class IncomeService {
  private readonly http = inject(HttpClient);

  getTemplates(): Observable<Income[]> {
    return this.http.get<Income[]>(`${API}/income/templates`)
      .pipe(catchError(() => of<Income[]>([])));
  }

  getAll(month?: number, year?: number): Observable<Income[]> {
    const params: Record<string, string> = {};
    if (month !== undefined) params['month'] = String(month);
    if (year  !== undefined) params['year']  = String(year);
    return this.http.get<Income[]>(`${API}/income`, { params })
      .pipe(catchError(() => of<Income[]>([])));
  }

  getMonthlyTotal(month: number, year: number, toDate?: string): Observable<number> {
    const params: Record<string, string> = { month: String(month), year: String(year) };
    if (toDate !== undefined) params['toDate'] = toDate;
    return this.http
      .get<{ total: number }>(`${API}/income/total`, { params })
      .pipe(
        map(r => Number(r.total)),
        catchError(() => of(0)),
      );
  }

  create(income: Income): Observable<Income> {
    return this.http.post<Income>(`${API}/income`, income);
  }

  update(id: number, income: Income): Observable<Income> {
    return this.http.put<Income>(`${API}/income/${id}`, income);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/income/${id}`);
  }

  getSourceType(value: string) {
    return SOURCE_TYPES.find(s => s.value === value) ?? SOURCE_TYPES[SOURCE_TYPES.length - 1];
  }
}
