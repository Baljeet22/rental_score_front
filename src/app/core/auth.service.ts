import { inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import { RoleChallenge, SessionTokens, UsersApiService } from './users-api.service';

export interface UserSession extends SessionTokens { email: string }
const SESSION_KEY = 'rental-score.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(UsersApiService);
  private readonly state = signal<UserSession | null>(this.restore());
  readonly session = this.state.asReadonly();
  readonly challenge = signal<(RoleChallenge & { email: string }) | null>(null);

  completeLogin(tokens: SessionTokens, email: string): void {
    const session = { ...tokens, email };
    this.state.set(session);
    this.challenge.set(null);
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* In-memory fallback. */ }
  }

  clear(): void {
    this.state.set(null);
    this.challenge.set(null);
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Storage can be disabled. */ }
  }

  ensureSession(): Observable<boolean> {
    const session = this.session();
    if (!session) return of(false);
    if (this.isCurrent(session.access)) return of(true);
    return this.api.refresh(session.refresh).pipe(
      map((tokens) => {
        this.completeLogin({ ...session, ...tokens }, session.email);
        return true;
      }),
      catchError(() => { this.clear(); return of(false); }),
    );
  }

  logout(): Observable<unknown> {
    const session = this.session();
    if (!session) return of(null);
    return this.api.logout(session.refresh).pipe(
      tap(() => this.clear()),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.clear();
          return of(null);
        }
        return throwError(() => error);
      }),
    );
  }

  private restore(): UserSession | null {
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
      if (value && typeof value === 'object' && 'access' in value && typeof value.access === 'string'
        && 'refresh' in value && typeof value.refresh === 'string'
        && 'role' in value && (value.role === 'owner' || value.role === 'tenant')
        && 'email' in value && typeof value.email === 'string') return value as UserSession;
    } catch { /* Invalid or unavailable storage starts a signed-out session. */ }
    return null;
  }

  private isCurrent(token: string): boolean {
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(part)) as { exp?: number };
      return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 30000;
    } catch { return false; }
  }
}
