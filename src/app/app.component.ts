import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <div class="app-shell" [class.account-shell]="accountPage()">
      <aside class="brand-panel">
        <a routerLink="/login" class="brand" aria-label="Rental Score home"><span class="brand-mark" aria-hidden="true">r<span>.</span></span>Rental<span class="fw-normal">Score</span></a>
        <div class="brand-story">
          <span class="eyebrow light">A BETTER RENTAL JOURNEY</span>
          <h1>Good rentals.<br>Great relationships.</h1>
          <p>A place for owners and tenants to take<br class="d-none d-xl-block"> the next step with confidence.</p>
          <div class="architecture" aria-hidden="true">
            <div class="sun"></div><div class="building back"><i></i><i></i><i></i><i></i><i></i><i></i></div>
            <div class="building front"><div class="roof"></div><i></i><i></i><i></i><i></i><div class="door"></div></div>
            <div class="tree"></div><div class="ground"></div>
          </div>
          <div class="brand-note"><span class="note-icon" aria-hidden="true">✓</span><div><strong>One account. Your next chapter.</strong><small>Built for both sides of the rental journey.</small></div></div>
        </div>
        <div class="brand-footer"><span>Thoughtfully connected.</span><span>EST. 2026</span></div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <span class="workspace-label">YOUR RENTAL JOURNEY, SIMPLIFIED</span>
          <a [routerLink]="auth.session() ? '/account' : '/login'" class="portal-link"><span class="status-dot"></span>{{ auth.session() ? 'Your account' : 'Account portal' }}</a>
        </header>
        <main id="main-content" tabindex="-1"><router-outlet /></main>
        <footer class="page-footer"><span>© {{ year }} Rental Score</span><span>Owners &amp; tenants, connected.</span></footer>
      </div>
    </div>
  `,
})
export class AppComponent {
  private readonly router = inject(Router);
  readonly accountPage = toSignal(this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map((event) => event.urlAfterRedirects.split(/[?#]/)[0] === '/account'),
  ), { initialValue: this.router.url.split(/[?#]/)[0] === '/account' });
  readonly auth = inject(AuthService);
  readonly year = new Date().getFullYear();
}
