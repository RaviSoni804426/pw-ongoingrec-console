import { expect, type Page } from '@playwright/test';

/**
 * Accounts created by the backend's `npm run seed`.
 *
 * There is one console role now. `manager` is kept as a name because what it
 * tests has not changed — an ADMIN restricted to a single centre cannot read
 * another centre's data.
 */
export const ACCOUNTS = {
  admin: { email: 'admin@pw.local', role: 'ADMIN' },
  manager: { email: 'kota.reviewer@pw.local', role: 'ADMIN' },
} as const;

export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe-Local-Dev-1';

export const login = async (page: Page, email: string): Promise<void> => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/$/);
  // The landing screen is the centre list — step one of the review flow.
  await expect(page.getByRole('heading', { name: 'Centres' })).toBeVisible();
};

/** The API base the console is pointed at, for direct assertions. */
export const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
