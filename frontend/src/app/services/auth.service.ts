import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map } from 'rxjs';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

interface AuthResponse {
  token: string;
  email: string;
  groupName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly TOKEN_KEY = 'auth_token';
  private readonly EMAIL_KEY = 'auth_email';
  private readonly GROUP_KEY  = 'auth_group';

  get token(): string | null        { return localStorage.getItem(this.TOKEN_KEY); }
  get currentEmail(): string | null { return localStorage.getItem(this.EMAIL_KEY); }
  get groupName(): string | null    { return localStorage.getItem(this.GROUP_KEY); }
  get isLoggedIn(): boolean         { return !!this.token; }

  login(email: string, password: string): Observable<void> {
    return this.http.post<AuthResponse>(`${API}/auth/login`, { email, password }).pipe(
      tap(res => this.storeSession(res)),
      map(() => void 0),
    );
  }

  register(email: string, password: string, name: string): Observable<void> {
    return this.http.post<AuthResponse>(`${API}/auth/register`, { email, password, name }).pipe(
      tap(res => this.storeSession(res)),
      map(() => void 0),
    );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.EMAIL_KEY);
    localStorage.removeItem(this.GROUP_KEY);
    this.router.navigate(['/login']);
  }

  private storeSession(res: AuthResponse) {
    localStorage.setItem(this.TOKEN_KEY, res.token);
    localStorage.setItem(this.EMAIL_KEY, res.email);
    localStorage.setItem(this.GROUP_KEY, res.groupName);
  }
}
