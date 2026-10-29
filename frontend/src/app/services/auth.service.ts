import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

export interface AuthResponse {
  token: string;
  username: string;
  groupName: string;
  groupCode: string | null;
  demo: boolean;
}

interface PendingResponse {
  pending: true;
  groupName: string;
}

export interface RegisterResult {
  pending: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly TOKEN_KEY      = 'auth_token';
  private readonly USERNAME_KEY   = 'auth_username';
  private readonly GROUP_KEY      = 'auth_group';
  private readonly GROUP_CODE_KEY = 'auth_group_code';
  private readonly DEMO_KEY       = 'auth_demo';

  get token(): string | null           { return localStorage.getItem(this.TOKEN_KEY); }
  get currentUsername(): string | null { return localStorage.getItem(this.USERNAME_KEY); }
  get groupName(): string | null       { return localStorage.getItem(this.GROUP_KEY); }
  get groupCode(): string | null       { return localStorage.getItem(this.GROUP_CODE_KEY); }
  get isLoggedIn(): boolean            { return !!this.token; }
  get isDemo(): boolean                { return localStorage.getItem(this.DEMO_KEY) === 'true'; }

  lastCreatedGroupCode: string | null = null;

  login(username: string, password: string): Observable<void> {
    return this.http.post<AuthResponse>(`${API}/auth/login`, { username, password }).pipe(
      tap(res => this.storeSession(res)),
      map(() => void 0),
    );
  }

  // Signs in to a fresh demo group with sample data; no account needed
  startDemo(): Observable<void> {
    return this.http.post<AuthResponse>(`${API}/auth/demo`, {}).pipe(
      tap(res => this.storeSession(res)),
      map(() => void 0),
    );
  }

  register(username: string, password: string, groupName?: string, groupCode?: string): Observable<RegisterResult> {
    return this.http.post<AuthResponse | PendingResponse>(`${API}/auth/register`, { username, password, groupName, groupCode }).pipe(
      map(res => {
        if ('pending' in res && res.pending) {
          return { pending: true };
        }
        const auth = res as AuthResponse;
        this.storeSession(auth);
        this.lastCreatedGroupCode = groupName ? auth.groupCode : null;
        return { pending: false };
      }),
    );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USERNAME_KEY);
    localStorage.removeItem(this.GROUP_KEY);
    localStorage.removeItem(this.GROUP_CODE_KEY);
    localStorage.removeItem(this.DEMO_KEY);
    this.router.navigate(['/login']);
  }

  storeSession(res: AuthResponse) {
    localStorage.setItem(this.TOKEN_KEY, res.token);
    localStorage.setItem(this.USERNAME_KEY, res.username);
    localStorage.setItem(this.GROUP_KEY, res.groupName);
    if (res.groupCode) localStorage.setItem(this.GROUP_CODE_KEY, res.groupCode);
    if (res.demo) localStorage.setItem(this.DEMO_KEY, 'true');
    else localStorage.removeItem(this.DEMO_KEY);
  }
}
