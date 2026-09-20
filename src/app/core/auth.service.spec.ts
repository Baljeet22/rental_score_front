import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

function accessToken(expires: number): string {
  return `header.${btoa(JSON.stringify({ exp: expires }))}.signature`;
}

describe('Users session lifecycle', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); sessionStorage.clear(); });

  it('rejects a missing session without sending a refresh request', () => {
    auth.ensureSession().subscribe((valid) => expect(valid).toBe(false));
    http.expectNone('/backend/token/refresh/');
  });

  it('accepts a current access token without refreshing it', () => {
    auth.completeLogin({ access: accessToken(Date.now() / 1000 + 3600), refresh: 'refresh', role: 'tenant' }, 'tenant@example.com');
    auth.ensureSession().subscribe((valid) => expect(valid).toBe(true));
    http.expectNone('/backend/token/refresh/');
  });

  it('persists the rotated refresh token before the next logout', () => {
    auth.completeLogin({ access: accessToken(0), refresh: 'old-refresh', role: 'owner' }, 'owner@example.com');
    auth.ensureSession().subscribe((valid) => expect(valid).toBe(true));
    const refresh = http.expectOne('/backend/token/refresh/');
    expect(refresh.request.body).toEqual({ refresh: 'old-refresh' });
    refresh.flush({ access: accessToken(Date.now() / 1000 + 3600), refresh: 'rotated-refresh' });
    expect(auth.session()?.refresh).toBe('rotated-refresh');
    expect(JSON.parse(sessionStorage.getItem('rental-score.session')!)['refresh']).toBe('rotated-refresh');
    auth.logout().subscribe();
    const logout = http.expectOne('/backend/users/logout/');
    expect(logout.request.body).toEqual({ refresh: 'rotated-refresh' });
    logout.flush({ detail: 'Logout successful.' });
    expect(auth.session()).toBeNull();
    expect(sessionStorage.getItem('rental-score.session')).toBeNull();
  });

  it('clears the session when refresh is rejected', () => {
    auth.completeLogin({ access: 'expired', refresh: 'expired', role: 'owner' }, 'owner@example.com');
    auth.ensureSession().subscribe((valid) => expect(valid).toBe(false));
    http.expectOne('/backend/token/refresh/').flush({ detail: 'Token is invalid.' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.session()).toBeNull();
  });

  it('keeps the refresh token available to retry a failed network logout', () => {
    auth.completeLogin({ access: 'access', refresh: 'refresh', role: 'tenant' }, 'tenant@example.com');
    auth.logout().subscribe({ error: () => {} });
    http.expectOne('/backend/users/logout/').error(new ProgressEvent('error'));
    expect(auth.session()?.refresh).toBe('refresh');
  });

  it('clears an already invalid refresh token on logout', () => {
    auth.completeLogin({ access: 'access', refresh: 'refresh', role: 'tenant' }, 'tenant@example.com');
    auth.logout().subscribe();
    http.expectOne('/backend/users/logout/').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.session()).toBeNull();
  });
});
