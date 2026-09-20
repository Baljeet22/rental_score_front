import { Component, computed, DestroyRef, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { apiErrors } from '../core/api-errors';

@Component({
  selector: 'app-account',
  imports: [RouterLink],
  template: `
    <section class="account-workspace" aria-label="Your account">
      <header class="account-header">
        <a routerLink="/account" class="brand account-brand" aria-label="Rental Score home">
          <span class="brand-mark" aria-hidden="true">r<span>.</span></span>Rental<span class="fw-normal">Score</span>
        </a>
        <div class="dropdown user-dropdown" #dropdown (focusout)="onFocusOut($event)">
          <button #toggle type="button" class="btn user-toggle dropdown-toggle" (click)="open.set(!open())"
            [attr.aria-expanded]="open()" aria-controls="account-dropdown">
            <span class="user-name">{{ displayName() }}</span>
            @if (auth.session()?.verified === true) {
              <span class="verified-tick" role="img" aria-label="Verified account" title="Verified account">&#10003;</span>
            }
          </button>
          @if (open()) {
            <div id="account-dropdown" class="dropdown-menu dropdown-menu-end show">
              <button type="button" class="dropdown-item logout-item" [disabled]="busy()" (click)="logout()">
                @if (busy()) { <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Logging out... }
                @else { Logout }
              </button>
              @if (error()) { <p class="logout-error" role="alert">{{ error() }}</p> }
            </div>
          }
        </div>
      </header>
      <h1 class="visually-hidden">Your account</h1>
    </section>
  `,
})
export class AccountComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dropdown = viewChild<ElementRef<HTMLElement>>('dropdown');
  private readonly toggle = viewChild<ElementRef<HTMLButtonElement>>('toggle');
  readonly displayName = computed(() => {
    const session = this.auth.session();
    return session?.first_name?.trim() || session?.last_name?.trim() || 'Account';
  });
  readonly open = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  @HostListener('document:click', ['$event'])
  onOutsideClick(event: MouseEvent): void {
    if (!this.dropdown()?.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.toggle()?.nativeElement.focus();
  }

  onFocusOut(event: FocusEvent): void {
    if (!this.dropdown()?.nativeElement.contains(event.relatedTarget as Node | null)) this.open.set(false);
  }

  logout(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: () => { void this.router.navigate(['/login']); },
      error: (error: unknown) => { this.error.set(Object.values(apiErrors(error)).join(' ')); this.open.set(true); },
    });
  }
}
