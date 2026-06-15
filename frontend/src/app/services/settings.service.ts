import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

export interface GroupSettings {
  groupName: string;
  groupCode: string;
  currency: string;
  members: string[];
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly CURRENCY_KEY = 'app_currency';

  get currency(): string { return localStorage.getItem(this.CURRENCY_KEY) ?? 'CAD'; }

  load(): Observable<GroupSettings> {
    return this.http.get<GroupSettings>(`${API}/settings`).pipe(
      tap(s => localStorage.setItem(this.CURRENCY_KEY, s.currency)),
    );
  }

  saveCurrency(currency: string): Observable<void> {
    return this.http.put<void>(`${API}/settings/currency`, { currency }).pipe(
      tap(() => localStorage.setItem(this.CURRENCY_KEY, currency)),
    );
  }
}
