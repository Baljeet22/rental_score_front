import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export type UserRole = 'owner' | 'tenant';
export interface SessionTokens { access: string; refresh: string; role: UserRole; first_name?: string | null; last_name?: string | null; verified?: boolean }
export interface RoleChallenge {
  requires_role_selection: true;
  available_roles: UserRole[];
  challenge_token: string;
}
export interface SignupRequest {
  email: string;
  password: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  dob?: string;
  is_owner: boolean;
  is_tenant: boolean;
}
export interface MessageResponse { detail: string }

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/backend/users';

  signup(body: SignupRequest) {
    return this.http.post<Omit<SignupRequest, 'password'> & { is_verified: boolean }>(`${this.base}/signup/`, body);
  }
  login(email: string, password: string) {
    return this.http.post<SessionTokens | RoleChallenge>(`${this.base}/login/`, { email, password });
  }
  selectRole(challenge_token: string, role: UserRole) {
    return this.http.post<SessionTokens>(`${this.base}/login/select-role/`, { challenge_token, role });
  }
  logout(refresh: string) {
    return this.http.post<MessageResponse>(`${this.base}/logout/`, { refresh });
  }
  verifyEmail(token: string) {
    return this.http.get<MessageResponse>(`${this.base}/verify-email/`, { params: { token } });
  }
  forgotPassword(email: string) {
    return this.http.post<MessageResponse>(`${this.base}/forgot-password/`, { email });
  }
  resetPassword(uid: string, token: string, new_password: string, confirm_password: string) {
    return this.http.post<MessageResponse>(`${this.base}/reset-password/`, { uid, token, new_password, confirm_password });
  }
  refresh(refresh: string) {
    return this.http.post<{ access: string; refresh?: string }>('/backend/token/refresh/', { refresh });
  }
}
