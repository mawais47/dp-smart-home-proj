import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthUser, LoginRequest } from '../models/auth.model';

const SESSION_KEY = 'session_id';

interface MeResponse {
  authenticated: boolean;
  username?: string;
  role?: 'user' | 'admin';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<AuthUser | null>(null);

  constructor(private http: HttpClient, private router: Router) {}

  get sessionId(): string | null {
    return sessionStorage.getItem(SESSION_KEY);
  }

  get isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  get isAdmin(): boolean {
    return this.currentUser()?.role === 'admin';
  }

  loadSession(): Observable<AuthUser | null> {
    if (!this.sessionId) {
      return of(null);
    }

    return this.http.get<MeResponse>(`${environment.apiBaseUrl}/api/auth/me`, {
      withCredentials: true,
      headers: this.authHeaders(),
    }).pipe(
      map(response => {
        if (!response.authenticated || !response.username || !response.role) {
          this.clearSession();
          return null;
        }
        const user: AuthUser = { username: response.username, role: response.role };
        this.currentUser.set(user);
        return user;
      }),
      catchError(() => {
        this.clearSession();
        return of(null);
      })
    );
  }

  login(credentials: LoginRequest): Observable<AuthUser> {
    return this.http.post<AuthUser>(
      `${environment.apiBaseUrl}/api/auth/login`,
      credentials,
      { withCredentials: true }
    ).pipe(
      tap(user => {
        if (user.sessionId) {
          this.setSessionId(user.sessionId);
        }
        this.currentUser.set({ username: user.username, role: user.role });
      }),
      map(user => ({ username: user.username, role: user.role }))
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/api/auth/logout`, {}, {
      withCredentials: true,
      headers: this.authHeaders(),
    }).pipe(
      tap(() => this.clearSession())
    );
  }

  authHeaders(): Record<string, string> {
    const sessionId = this.sessionId;
    return sessionId ? { 'X-Session-ID': sessionId } : {};
  }

  setSessionId(sessionId: string): void {
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  clearSession(): void {
    sessionStorage.removeItem(SESSION_KEY);
    this.currentUser.set(null);
  }

  redirectAfterLogin(role: string): void {
    this.router.navigate(['/dashboard']);
  }

  redirectToLogin(): void {
    this.router.navigate(['/login']);
  }
}
