import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './core/auth.service';
import { AuthPageComponent } from './pages/auth-page.component';
import { AccountComponent } from './pages/account.component';

const signedIn: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).ensureSession().pipe(map((valid) => valid || router.createUrlTree(['/login'])));
};
const hasChallenge: CanActivateFn = () => inject(AuthService).challenge() ? true : inject(Router).createUrlTree(['/login']);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: AuthPageComponent, data: { mode: 'login' }, title: 'Sign in | Rental Score' },
  { path: 'signup', component: AuthPageComponent, data: { mode: 'signup' }, title: 'Create an account | Rental Score' },
  { path: 'forgot-password', component: AuthPageComponent, data: { mode: 'forgot' }, title: 'Forgot password | Rental Score' },
  { path: 'reset-password', component: AuthPageComponent, data: { mode: 'reset' }, title: 'Reset password | Rental Score' },
  { path: 'verify-email', component: AuthPageComponent, data: { mode: 'verify' }, title: 'Verify email | Rental Score' },
  { path: 'select-role', component: AuthPageComponent, canActivate: [hasChallenge], data: { mode: 'role' }, title: 'Choose your role | Rental Score' },
  { path: 'account', component: AccountComponent, canActivate: [signedIn], title: 'Your account | Rental Score' },
  { path: 'api/users/verify-email', component: AuthPageComponent, data: { mode: 'verify' }, title: 'Verify email | Rental Score' },
  { path: 'api/users/reset-password', component: AuthPageComponent, data: { mode: 'reset' }, title: 'Reset password | Rental Score' },
  { path: '**', redirectTo: 'login' },
];
