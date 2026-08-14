import { expect, test } from '@playwright/test';
import { ACCOUNTS, apiBase, login, SEED_PASSWORD } from './helpers';

test.describe('authentication', () => {
  test('redirects an unauthenticated visitor to the sign-in page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('rejects bad credentials without signing in', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ACCOUNTS.admin.email);
    await page.getByLabel('Password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByTestId('login-error')).toContainText(/invalid/i);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('signs in and lands on fleet health', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);
    await expect(page.getByTestId('installation-row').first()).toBeVisible();
  });
});

test.describe('fleet health', () => {
  test('shows agent state, device faults and the installation table', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);

    // The seed deliberately leaves one installation UNHEALTHY with a removed
    // device, so an all-green fleet screen would mean the data is not real.
    await expect(page.getByTestId('fleet-device-faults')).not.toHaveText('0');
    await expect(page.getByTestId('installation-row')).not.toHaveCount(0);
  });

  test('opens installation detail with heartbeats and gaps', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);
    await page.getByTestId('installation-row').first().getByRole('link').first().click();

    await expect(page.getByRole('heading', { name: 'Capture gaps' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Heartbeat timeline' })).toBeVisible();
  });
});

test.describe('org explorer and counsellor detail', () => {
  test('drills centre → counsellor → conversation', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);

    await page.getByRole('link', { name: 'Org explorer' }).click();
    await expect(page.getByTestId('centre-node').first()).toBeVisible();

    await page.getByTestId('counsellor-link').first().click();
    await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible();
    await expect(page.getByTestId('counsellor-conversation-link').first()).toBeVisible();
  });
});

test.describe('conversations', () => {
  test('lists conversations and paginates', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);
    await page.getByRole('link', { name: 'Conversations' }).click();

    await expect(page.getByTestId('conversation-row').first()).toBeVisible();

    const next = page.getByTestId('pagination-next');
    if (await next.isEnabled()) {
      const firstBefore = await page.getByTestId('conversation-row').first().innerText();
      await next.click();
      await expect(page.getByTestId('conversation-row').first()).not.toHaveText(firstBefore);
    }
  });

  test('streams audio and seeks with the player', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);
    await page.getByRole('link', { name: 'Conversations' }).click();
    await page.getByTestId('conversation-link').first().click();

    // Playback is opt-in because requesting the URL is the logged access event.
    await page.getByTestId('start-playback').click();

    await expect(page.getByTestId('conversation-player')).toBeVisible();
    await expect(page.getByTestId('player-playpause')).toBeEnabled({ timeout: 30_000 });

    const before = await page.getByTestId('player-time').innerText();
    await page.getByTestId('player-forward').click();
    await expect(page.getByTestId('player-time')).not.toHaveText(before);
  });

  test('download requires a typed reason', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);
    await page.getByRole('link', { name: 'Conversations' }).click();
    await page.getByTestId('conversation-link').first().click();

    const submit = page.getByTestId('download-submit');
    await expect(submit).toBeDisabled();

    await page.getByTestId('download-reason').fill('too short');
    await expect(submit).toBeDisabled();

    await page.getByTestId('download-reason').fill('Coaching evidence for the weekly team review');
    await expect(submit).toBeEnabled();
  });
});

test.describe('coverage', () => {
  test('renders the centre × day grid and drills to a counsellor', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);
    await page.getByRole('link', { name: 'Coverage' }).click();

    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible();
    // Cut A ships a mock CRM, so the screen must say so rather than presenting
    // a structurally-zero coverage number as a real one.
    await expect(page.getByText('CRM linkage is not connected in this build.')).toBeVisible();

    const drilldown = page.getByTestId('coverage-drilldown').first();
    if (await drilldown.count()) {
      await drilldown.click();
      await expect(page.getByRole('heading', { name: '30-day coverage trend' })).toBeVisible();
    }
  });
});

test.describe('RBAC', () => {
  test('a MANAGER cannot see the compliance surface', async ({ page }) => {
    await login(page, ACCOUNTS.manager.email);
    await expect(page.getByRole('link', { name: 'Compliance' })).toHaveCount(0);
  });

  test('a MANAGER is refused another team’s conversation by direct URL', async ({ page, request }) => {
    // Find a conversation belonging to a counsellor outside the manager's team,
    // using the admin account to look it up.
    const adminLogin = await request.post(`${apiBase}/auth/login`, {
      data: { email: ACCOUNTS.admin.email, password: SEED_PASSWORD },
    });
    const adminToken = (await adminLogin.json()).data.accessToken as string;

    const managerLogin = await request.post(`${apiBase}/auth/login`, {
      data: { email: ACCOUNTS.manager.email, password: SEED_PASSWORD },
    });
    const managerToken = (await managerLogin.json()).data.accessToken as string;

    const allRes = await request.get(`${apiBase}/conversations?limit=200`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const all = (await allRes.json()).data.items as { _id: string }[];

    const mineRes = await request.get(`${apiBase}/conversations?limit=200`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const mine = (await mineRes.json()).data.items as { _id: string }[];

    const mineIds = new Set(mine.map((c) => c._id));
    const foreign = all.find((c) => !mineIds.has(c._id));

    expect(foreign, 'seed must contain a conversation outside the manager scope').toBeTruthy();

    // The API refuses it outright...
    const direct = await request.get(`${apiBase}/conversations/${foreign!._id}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    expect(direct.status()).toBe(404);

    // ...and the UI surfaces the refusal rather than rendering the record.
    await login(page, ACCOUNTS.manager.email);
    await page.goto(`/conversations/${foreign!._id}`);
    await expect(page.getByTestId('error-block')).toBeVisible();
    await expect(page.getByTestId('start-playback')).toHaveCount(0);
  });
});

test.describe('compliance', () => {
  test('shows the access log for an admin', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);
    await page.getByRole('link', { name: 'Compliance' }).click();

    await expect(page.getByRole('heading', { name: 'Access log' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Purge log' })).toBeVisible();
  });

  test('playback writes an access-log row', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);

    await page.getByRole('link', { name: 'Conversations' }).click();
    await page.getByTestId('conversation-link').first().click();
    await page.getByTestId('start-playback').click();
    await expect(page.getByTestId('conversation-player')).toBeVisible();

    await page.getByRole('link', { name: 'Compliance' }).click();
    await expect(page.getByTestId('access-log-row').first()).toBeVisible();
    await expect(page.getByTestId('access-log-row').first()).toContainText('STREAM');
  });
});

test.describe('enrollment', () => {
  test('generates a one-time provisioning token', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);
    await page.getByRole('link', { name: 'Enrollment' }).click();

    await page.getByLabel('Counsellor to enrol').selectOption({ index: 1 });
    await page.getByTestId('generate-token').click();

    await expect(page.getByTestId('enroll-token')).toBeVisible();
    await expect(page.getByTestId('enroll-token')).not.toBeEmpty();
  });
});

test.describe('transcript', () => {
  test('renders turns, marks provisional speakers, and syncs with the player', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);
    await page.getByRole('link', { name: 'Conversations' }).click();
    // A different row from the one the speaker-correction test confirms, so
    // neither test depends on the other having run — or not having run.
    await page.getByTestId('conversation-link').nth(1).click();

    await expect(page.getByTestId('transcript-panel')).toBeVisible();
    await expect(page.getByTestId('transcript-turn').first()).toBeVisible();

    // The counsellor tag is a heuristic until a person confirms it, and the
    // screen has to say so — an auditor shown an unmarked talk ratio that may
    // be inverted is being actively misled.
    await expect(page.getByTestId('speaker-provisional')).toBeVisible();

    // A turn the engine was unsure about is marked rather than presented as
    // equal to the rest.
    await expect(page.getByTestId('low-confidence').first()).toBeVisible();

    // Clicking a timestamp seeks the audio. Playback has to be open first,
    // because loading the audio is the logged access event.
    await page.getByTestId('start-playback').click();
    await expect(page.getByTestId('player-playpause')).toBeEnabled({ timeout: 30_000 });

    const before = await page.getByTestId('player-time').innerText();
    await page.getByTestId('transcript-seek').nth(2).click();
    await expect(page.getByTestId('player-time')).not.toHaveText(before);
  });

  test('an auditor can confirm the counsellor in one click', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email);
    await page.getByRole('link', { name: 'Conversations' }).click();
    await page.getByTestId('conversation-link').nth(2).click();

    await expect(page.getByTestId('speaker-control')).toBeVisible();

    // Choose whichever speaker is not currently tagged. Asserting the
    // heuristic-to-manual transition specifically would only pass against a
    // freshly seeded database, and a test that needs a pristine database is a
    // test that will waste somebody's afternoon.
    const current = await page.getByTestId('speaker-control').innerText();
    const target = current.includes('Speaker B confirmed') ? 'A' : 'B';

    // One click. Acceptance criterion 3.
    await page.getByTestId(`speaker-choose-${target}`).click();

    await expect(page.getByTestId('speaker-confirmed')).toContainText(
      `Speaker ${target} confirmed`,
    );
    await expect(page.getByTestId('speaker-provisional')).toHaveCount(0);

    // And it survives a reload: the correction is stored, not local state.
    await page.reload();
    await expect(page.getByTestId('speaker-confirmed')).toContainText(
      `Speaker ${target} confirmed`,
    );
  });

  test('says when a transcript may not be scored automatically', async ({ page }) => {
    // The seed withholds every fifth conversation from auto-audit, so at least
    // one conversation list page must surface the closed gate.
    await login(page, ACCOUNTS.admin.email);
    await page.getByRole('link', { name: 'Conversations' }).click();

    const links = page.getByTestId('conversation-link');
    // count() does not auto-wait the way click() does, so without this it reads
    // zero before the list has loaded and the loop silently does nothing.
    await expect(links.first()).toBeVisible();
    const count = Math.min(await links.count(), 6);

    let sawWithheld = false;
    for (let i = 0; i < count; i++) {
      await links.nth(i).click();
      await expect(page.getByTestId('transcript-quality')).toBeVisible();

      if ((await page.getByTestId('transcript-quality').innerText()).includes('Not eligible')) {
        sawWithheld = true;
        break;
      }
      await page.goBack();
    }

    expect(sawWithheld, 'the seed must withhold at least one conversation from auto-audit').toBe(
      true,
    );
  });
});
