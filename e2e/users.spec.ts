import { expect, test, Page } from '@playwright/test';

function tokens(role: 'owner' | 'tenant' = 'tenant') {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return { access: `header.${payload}.signature`, refresh: 'test-refresh', role, first_name: 'Jamie', last_name: 'Taylor', verified: true };
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill('TENANT@example.com');
  await page.getByLabel('Password', { exact: true }).fill('LongExample!Password82');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  // A missing mock fails locally instead of modifying accounts on the real backend.
  await page.route('**/backend/**', (route) => route.fulfill({ status: 501, json: { detail: 'Unmocked API request in browser test.' } }));
});

test('login, protected account reload, and logout', async ({ page }) => {
  await page.route('**/backend/users/login/', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email: 'tenant@example.com', password: 'LongExample!Password82' });
    await route.fulfill({ json: tokens() });
  });
  await page.route('**/backend/users/logout/', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ refresh: 'test-refresh' });
    await route.fulfill({ json: { detail: 'Logout successful.' } });
  });
  await signIn(page);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('button', { name: /Jamie/ })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Verified account' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Jamie/ }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login$/);
});

test('dual-role account selects role with the challenge token', async ({ page }) => {
  await page.route('**/backend/users/login/', (route) => route.fulfill({ json: { requires_role_selection: true, available_roles: ['owner', 'tenant'], challenge_token: 'test-challenge' } }));
  await page.route('**/backend/users/login/select-role/', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ challenge_token: 'test-challenge', role: 'owner' });
    await route.fulfill({ json: tokens('owner') });
  });
  await signIn(page);
  await expect(page).toHaveURL(/\/select-role$/);
  await page.getByRole('radio', { name: /Property owner/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('button', { name: /Jamie/ })).toBeVisible();
});

test('sign-up validates confirmation and sends one role without protected fields', async ({ page }) => {
  let requests = 0;
  await page.route('**/backend/users/signup/', async (route) => {
    requests++;
    expect(route.request().postDataJSON()).toEqual({ email: 'new@example.com', password: 'LongExample!Password82', first_name: 'Jamie', is_owner: false, is_tenant: true });
    await route.fulfill({ status: 201, json: { email: 'new@example.com', is_verified: false } });
  });
  await page.goto('/signup');
  await page.getByRole('radio', { name: /Tenant/ }).check();
  await page.getByLabel('First name').fill('Jamie');
  await page.getByLabel('Email address', { exact: true }).fill('new@example.com');
  await page.getByLabel('Password', { exact: true }).fill('LongExample!Password82');
  await page.getByLabel('Confirm password', { exact: true }).fill('DifferentPassword82');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Your passwords do not match.')).toBeVisible();
  expect(requests).toBe(0);
  await page.getByLabel('Confirm password', { exact: true }).fill('LongExample!Password82');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  expect(requests).toBe(1);
});

test('server field errors and failed login remain actionable', async ({ page }) => {
  await page.route('**/backend/users/login/', (route) => route.fulfill({ status: 401, json: { detail: 'Invalid email or password or account is still inactive, please check your email.' } }));
  await signIn(page);
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  await page.route('**/backend/users/signup/', (route) => route.fulfill({ status: 400, json: { email: ['A user with this email already exists.'], password: ['This password is too common.'] } }));
  await page.goto('/signup');
  await page.getByRole('radio', { name: /Tenant/ }).check();
  await page.getByLabel('Email address', { exact: true }).fill('existing@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Password123');
  await page.getByLabel('Confirm password', { exact: true }).fill('Password123');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('A user with this email already exists.')).toBeVisible();
  await expect(page.getByText('This password is too common.')).toBeVisible();
});

test('forgot password displays the enumeration-safe API response', async ({ page }) => {
  await page.route('**/backend/users/forgot-password/', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email: 'tenant@example.com' });
    await route.fulfill({ json: { detail: 'If an account exists with this email, a password reset link has been sent.' } });
  });
  await page.goto('/forgot-password');
  await page.getByLabel('Email address', { exact: true }).fill('tenant@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
});

test('Django reset link submits its uid and token and removes them on success', async ({ page }) => {
  await page.route('**/backend/users/reset-password/', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ uid: 'MQ', token: 'reset-token', new_password: 'LongExample!Password82', confirm_password: 'LongExample!Password82' });
    await route.fulfill({ json: { detail: 'Password has been reset successfully.' } });
  });
  await page.goto('/api/users/reset-password/?uid=MQ&token=reset-token');
  await page.getByLabel('New password', { exact: true }).fill('LongExample!Password82');
  await page.getByLabel('Confirm password', { exact: true }).fill('LongExample!Password82');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Password has been reset successfully.');
  await expect(page).not.toHaveURL(/token=/);
});

test('Django email link verifies by GET and handles expired links', async ({ page }) => {
  await page.route('**/backend/users/verify-email/?token=*', (route) => route.fulfill({ status: 400, json: { detail: 'Verification link has expired.' } }));
  await page.goto('/api/users/verify-email/?token=expired-token');
  await page.getByRole('button', { name: 'Verify email address' }).click();
  await expect(page.getByRole('alert')).toContainText('Verification link has expired.');
  await page.route('**/backend/users/verify-email/?token=*', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: { detail: 'Email verified successfully.' } });
  });
  await page.getByRole('button', { name: 'Verify email address' }).click();
  await expect(page.getByRole('status')).toContainText('Email verified successfully.');
});

test('missing links and direct role navigation are handled without API calls', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByRole('alert')).toContainText('This link is incomplete.');
  await expect(page.getByRole('button', { name: 'Reset password' })).toHaveCount(0);
  await page.goto('/verify-email');
  await expect(page.getByRole('alert')).toContainText('This link is incomplete.');
  await page.goto('/select-role');
  await expect(page).toHaveURL(/\/login$/);
});

test('forms are responsive, labelled, and validate empty submissions', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Email address', { exact: true })).toBeFocused();
  await expect(page.getByText('Please complete this field.')).toHaveCount(2);
  await page.getByLabel('Password', { exact: true }).fill('test');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/login-${test.info().project.name}.png`, fullPage: true });
});


test('account dropdown uses last name and supports keyboard dismissal', async ({ page }) => {
  await page.route('**/backend/users/login/', route => route.fulfill({ json: { ...tokens(), first_name: '  ', last_name: 'Taylor', verified: false } }));
  await signIn(page);
  const toggle = page.getByRole('button', { name: 'Taylor', exact: true });
  await expect(toggle).toBeVisible();
  await expect(page.getByRole('img', { name: 'Verified account' })).toHaveCount(0);
  await expect(page.locator('.brand-panel')).toBeHidden();
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Logout' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.locator('.account-workspace').click({ position: { x: 20, y: 200 } });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
