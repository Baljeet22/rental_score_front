import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { apiErrors } from '../core/api-errors';
import { SessionTokens, SignupRequest, UserRole, UsersApiService } from '../core/users-api.service';

type Mode = 'login' | 'signup' | 'forgot' | 'reset' | 'verify' | 'role';
interface Field { key: string; label: string; type: string; autocomplete: string; placeholder: string; optional?: boolean; half?: boolean; max?: number }
const EMAIL: Field = { key: 'email', label: 'Email address', type: 'email', autocomplete: 'email', placeholder: 'you@example.com', max: 254 };
const PASSWORD: Field = { key: 'password', label: 'Password', type: 'password', autocomplete: 'current-password', placeholder: 'Enter your password' };
const COPY: Record<Mode, { eyebrow: string; title: string; description: string; action: string }> = {
  login: { eyebrow: 'WELCOME BACK', title: 'Make yourself at home.', description: 'Sign in to continue your Rental Score journey.', action: 'Sign in' },
  signup: { eyebrow: 'YOUR NEXT CHAPTER', title: 'Let’s get you settled.', description: 'Create your account and start your rental journey.', action: 'Create account' },
  forgot: { eyebrow: 'ACCOUNT RECOVERY', title: 'Forgot your password?', description: 'It happens. Enter your email and we’ll send you a reset link.', action: 'Send reset link' },
  reset: { eyebrow: 'A FRESH START', title: 'Set a new password.', description: 'Choose a strong password that you haven’t used before.', action: 'Reset password' },
  verify: { eyebrow: 'ONE LAST STEP', title: 'Verify your email.', description: 'Confirm your email address to activate your account.', action: 'Verify email address' },
  role: { eyebrow: 'YOUR ACCOUNT, YOUR WAY', title: 'How are you joining us?', description: 'Your account has two roles. Choose one for this session.', action: 'Continue' },
};

const matchPasswords: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const first = control.get('new_password') ?? control.get('password');
  const confirmation = control.get('confirm_password');
  return first && confirmation && first.value !== confirmation.value ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth-page.component.html',
})
export class AuthPageComponent {
  private readonly api = inject(UsersApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  readonly mode = this.route.snapshot.data['mode'] as Mode;
  readonly copy = COPY[this.mode];
  readonly busy = signal(false);
  readonly success = signal('');
  readonly errors = signal<Record<string, string>>({});
  readonly showPassword = signal(false);
  readonly today = new Date().toLocaleDateString('en-CA');
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  private readonly uid = this.route.snapshot.queryParamMap.get('uid') ?? '';
  readonly missingLink = (this.mode === 'verify' && !this.token) || (this.mode === 'reset' && (!this.uid || !this.token));
  readonly roles: UserRole[] = this.mode === 'role' ? this.auth.challenge()?.available_roles ?? [] : ['tenant', 'owner'];
  readonly fields = this.buildFields();
  readonly form = this.buildForm();

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.errors.set({}));
  }

  private buildFields(): Field[] {
    switch (this.mode) {
      case 'login': return [EMAIL, PASSWORD];
      case 'forgot': return [EMAIL];
      case 'signup': return [
        { key: 'first_name', label: 'First name', type: 'text', autocomplete: 'given-name', placeholder: 'First name', optional: true, half: true, max: 150 },
        { key: 'last_name', label: 'Last name', type: 'text', autocomplete: 'family-name', placeholder: 'Last name', optional: true, half: true, max: 150 },
        { key: 'middle_name', label: 'Middle name', type: 'text', autocomplete: 'additional-name', placeholder: 'Middle name', optional: true, half: true, max: 150 },
        { key: 'dob', label: 'Date of birth', type: 'date', autocomplete: 'bday', placeholder: '', optional: true, half: true },
        EMAIL, { ...PASSWORD, autocomplete: 'new-password', placeholder: 'Create a strong password' },
        { key: 'confirm_password', label: 'Confirm password', type: 'password', autocomplete: 'new-password', placeholder: 'Repeat your password' },
      ];
      case 'reset': return [
        { ...PASSWORD, key: 'new_password', label: 'New password', autocomplete: 'new-password', placeholder: 'Create a strong password' },
        { key: 'confirm_password', label: 'Confirm password', type: 'password', autocomplete: 'new-password', placeholder: 'Repeat your password' },
      ];
      default: return [];
    }
  }

  private buildForm(): FormGroup<Record<string, FormControl<string>>> {
    const controls: Record<string, FormControl<string>> = {};
    for (const field of this.fields) {
      const validators = field.optional ? [] : [Validators.required];
      if (field.type === 'email') validators.push(Validators.email);
      if (field.max) validators.push(Validators.maxLength(field.max));
      if (field.type === 'password' && this.mode !== 'login') validators.push(Validators.minLength(8));
      if (field.key === 'dob') validators.push((control) => control.value && control.value > this.today ? { futureDate: true } : null);
      controls[field.key] = new FormControl('', { nonNullable: true, validators });
    }
    if (this.mode === 'signup' || this.mode === 'role') controls['role'] = new FormControl('', { nonNullable: true, validators: [Validators.required] });
    return new FormGroup(controls, { validators: matchPasswords });
  }

  fieldError(key: string): string {
    if (this.errors()[key]) return this.errors()[key];
    const control = this.form.get(key);
    if (!control?.touched) return '';
    if (control.hasError('required')) return key === 'role' ? 'Choose a role to continue.' : 'Please complete this field.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('minlength')) return 'Use at least 8 characters.';
    if (control.hasError('maxlength')) return 'This value is too long.';
    if (control.hasError('futureDate')) return 'Date of birth cannot be in the future.';
    if (key === 'confirm_password' && this.form.hasError('passwordMismatch')) return 'Your passwords do not match.';
    return '';
  }

  errorSummary(): string[] {
    return Object.entries(this.errors()).filter(([key]) => !this.fields.some((field) => field.key === key)).map(([, value]) => value);
  }

  submit(): void {
    if (this.busy() || this.success() || this.missingLink) return;
    this.errors.set({});
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      const invalid = this.fields.find((field) => this.fieldError(field.key));
      this.element.nativeElement.querySelector<HTMLElement>(invalid ? `#${invalid.key}` : 'input[name="role"]')?.focus();
      return;
    }
    const value = this.form.getRawValue();
    const email = value['email']?.trim().toLowerCase() ?? '';
    switch (this.mode) {
      case 'login':
        this.run(this.api.login(email, value['password']), (response) => {
          this.form.get('password')?.reset();
          if ('requires_role_selection' in response) {
            this.auth.clear();
            this.auth.challenge.set({ ...response, email });
            void this.router.navigate(['/select-role']);
          } else this.finishLogin(response, email);
        });
        break;
      case 'signup': {
        const body: SignupRequest = { email, password: value['password'], is_owner: value['role'] === 'owner', is_tenant: value['role'] === 'tenant' };
        for (const key of ['first_name', 'middle_name', 'last_name', 'dob'] as const) {
          if (value[key]?.trim()) body[key] = value[key].trim();
        }
        this.run(this.api.signup(body), () => {
          this.form.reset();
          this.success.set('Your account has been created. Check your inbox and follow the verification link before signing in.');
        });
        break;
      }
      case 'forgot':
        this.run(this.api.forgotPassword(email), (response) => this.success.set(response.detail));
        break;
      case 'reset':
        this.run(this.api.resetPassword(this.uid, this.token, value['new_password'], value['confirm_password']), (response) => {
          this.form.reset();
          this.auth.clear();
          this.success.set(response.detail);
          void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
        });
        break;
      case 'verify':
        this.run(this.api.verifyEmail(this.token), (response) => {
          this.success.set(response.detail);
          void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
        });
        break;
      case 'role': {
        const challenge = this.auth.challenge();
        if (!challenge) { void this.router.navigate(['/login']); return; }
        this.run(this.api.selectRole(challenge.challenge_token, value['role'] as UserRole), (response) => this.finishLogin(response, challenge.email));
        break;
      }
    }
  }

  private finishLogin(tokens: SessionTokens, email: string): void {
    this.auth.completeLogin(tokens, email);
    void this.router.navigate(['/account']);
  }

  private run<T>(request: Observable<T>, onSuccess: (value: T) => void): void {
    this.busy.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: onSuccess,
      error: (error: unknown) => this.errors.set(apiErrors(error)),
    });
  }
}
