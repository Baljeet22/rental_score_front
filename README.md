# Rental Score — users frontend

Angular 21 standalone application with Bootstrap 5.3.8. Scope is the existing Django **users app**: sign-up, login, owner/tenant selection, email verification, forgot/reset password, and logout. The account page is an empty workspace with a top-right name dropdown, a tick when session `verified` is true, and logout; there is no users-list or profile-edit endpoint in this backend.

## Run locally

Prerequisite: Node.js 24 LTS (or Node 22.12+) and Django running at `http://localhost:8000`.

```powershell
npm ci
npm start
```

Open `http://localhost:4200`. This workspace also includes a git-ignored portable Node runtime: `powershell -ExecutionPolicy Bypass -File .\start.ps1` uses it automatically when present.

Angular requests `/backend/...`; `proxy.conf.json` forwards those requests to Django's `/api/...`. Keeping these prefixes separate allows the browser to open the `/api/users/verify-email/` and `/api/users/reset-password/` paths already used in Django emails without the development proxy intercepting the pages.

**Email links:** set the backend's `FRONTEND_URL=http://localhost:4200` and restart the backend process/container so newly generated emails open Angular. Existing emails retain their original hostname. The frontend accepts both the Django-style paths above and `/verify-email?token=...` / `/reset-password?uid=...&token=...`. No backend files have been changed.

## API contract

Contracts were inspected from the running API's OPTIONS responses and the matching `users/views.py`, `users/serializers.py`, and regression tests.

| Endpoint | Method | Frontend behavior |
| --- | --- | --- |
| `/api/users/signup/` | POST | Email, password, optional names/date of birth, exactly one of `is_owner`/`is_tenant`; prompts for email verification after success. |
| `/api/users/login/` | POST | Email/password; accepts tokens or the `requires_role_selection` challenge. |
| `/api/users/login/select-role/` | POST | Sends `challenge_token` and an available `role`; challenge stays in memory. |
| `/api/users/verify-email/?token=...` | GET | Explicitly verifies the email; displays invalid/expired-link errors. |
| `/api/users/forgot-password/` | POST | Sends email; preserves the backend's account-enumeration-safe response. |
| `/api/users/reset-password/` | POST | Sends `uid`, `token`, `new_password`, and `confirm_password`. |
| `/api/users/logout/` | POST | Blacklists the current refresh token before clearing local session state. |
| `/api/token/refresh/` | POST | Refreshes expired access tokens when entering the protected account page; persists rotated refresh tokens. |

The sign-up form intentionally omits the optional address relation because address management is outside the requested users-only scope. It never submits `is_verified`; verification is controlled by the backend. Server-side Django password validation messages appear beside the corresponding field.

## Session behavior

Tokens live in tab-scoped `sessionStorage`, with an in-memory fallback when browser storage is unavailable. Passwords and role-selection challenges are never persisted. JWT expiry is used for frontend navigation only; Django remains responsible for authentication and authorization. A network error during logout keeps the session available for retry; an already expired/revoked refresh token clears local state. There is no background refresh because this scope has no authenticated data requests beyond the account session.

## Checks

```powershell
npm run build
npm test
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.tools\browsers"
npx playwright install chromium
npm run test:e2e
```

Unit tests cover token rotation, session expiry, logout failure, and server error mapping. Browser tests cover all users flows on desktop and mobile using mocked responses, and cannot create users or send email through the real backend. Screenshots and failure traces are written to `test-results/`.

## Deployment

Serve `dist/rental-score/browser` with SPA fallback to `index.html`. Forward `/backend/*` to the Django `/api/*` routes using your reverse proxy (the Angular development proxy is not included in a production build). Set `FRONTEND_URL` to the public frontend origin. Serve the app over HTTPS. Email routes must resolve to the SPA, not a raw Django response.

Version references: [Angular compatibility](https://angular.dev/reference/versions) and [Bootstrap installation](https://getbootstrap.com/docs/5.3/getting-started/download/).
