import { expect, type Page } from '@playwright/test';

/** Accounts created by the backend's `npm run seed`. */
export const ACCOUNTS = {
  admin: { email: 'admin@pw.local', role: 'SUPER_ADMIN' },
  centreHead: { email: 'rajesh.head@pw.local', role: 'CENTRE_HEAD' },
  manager: { email: 'priya.manager@pw.local', role: 'MANAGER' },
} as const;

export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe-Local-Dev-1';

export const login = async (page: Page, email: string): Promise<void> => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Fleet health' })).toBeVisible();
};

/** The API base the console is pointed at, for direct assertions. */
export const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
