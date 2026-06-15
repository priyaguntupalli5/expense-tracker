import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map } from 'rxjs';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

interface AuthResponse {
  token: string;
  username: string;
  groupName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly TOKEN_KEY    = 'auth_token';
  private readonly USERNAME_KEY = 'auth_username';
  private readonly GROUP_KEY    = 'auth_group';

  get token(): string | null         { return localStorage.getItem(this.TOKEN_KEY); }
  get currentUsername(): string | null { return localStorage.getItem(this.USERNAME_KEY); }
  get groupName(): string | null     { return localStorage.getItem(this.GROUP_KEY); }
  get isLoggedIn(): boolean          { return !!this.token; }

  login(username: string, password: string): Observable<void> {
    return this.http.post<AuthResponse>(`${API}/auth/login`, { username, password }).pipe(
      tap(res => this.storeSession(res)),
      map(() => void 0),
    );
  }

  register(username: string, password: string, groupName: string): Observable<void> {
    return this.http.post<AuthResponse>(`${API}/auth/register`, { username, password, groupName }).pipe(
      tap(res => this.storeSession(res)),
      map(() => void 0),
    );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USERNAME_KEY);
    localStorage.removeItem(this.GROUP_KEY);
    this.router.navigate(['/login']);
  }

  private storeSession(res: AuthResponse) {
    localStorage.setItem(this.TOKEN_KEY, res.token);
    localStorage.setItem(this.USERNAME_KEY, res.username);
    localStorage.setItem(this.GROUP_KEY, res.groupName);
  }
}
