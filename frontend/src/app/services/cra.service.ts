import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CraEntry } from '../models/cra.model';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class CraService {
  private readonly http = inject(HttpClient);

  getAll(year?: number): Observable<CraEntry[]> {
    const params: Record<string, string> = {};
    if (year) params['year'] = year.toString();
    return this.http.get<CraEntry[]>(`${API}/cra`, { params });
  }

  create(entry: CraEntry): Observable<CraEntry> {
    return this.http.post<CraEntry>(`${API}/cra`, entry);
  }

  update(id: number, entry: CraEntry): Observable<CraEntry> {
    return this.http.put<CraEntry>(`${API}/cra/${id}`, entry);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/cra/${id}`);
  }

  importEntries(entries: CraEntry[]): Observable<CraEntry[]> {
    return this.http.post<CraEntry[]>(`${API}/cra/import`, entries);
  }

  exportToFile(entries: CraEntry[], year: number) {
    const payload = entries.map(({ id: _id, ...rest }) => rest);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cra-${year}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
