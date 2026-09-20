import { test, expect } from '@playwright/test';

test.describe('replay-only decision lab', () => {
  test('gallery -> PoC -> sample replay -> persisted history', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Reflex Arena' }).click();
    await expect(page.getByRole('heading', { name: 'Reflex Arena' })).toBeVisible();
    await page.getByRole('link', { name: 'Run sample replay' }).click();
    await expect(page.getByRole('heading', { name: 'Sample evaluation' })).toBeVisible();
    await page.getByRole('button', { name: 'Run sample' }).click();
    await expect(page.getByTestId('sample-result')).toContainText('replay');
    await page.getByRole('link', { name: 'Runs' }).click();
    await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();
    await expect(page.locator('.run').first()).toContainText('replay');
  });

  test('live mode stays unauthorized without a key and never falls back', async ({ page }) => {
    await page.goto('/pocs/reflex-arena/eval');
    await page.getByRole('button', { name: 'Jev live' }).click();
    await page.getByRole('button', { name: 'Run sample' }).click();
    await expect(page.getByTestId('sample-result')).toContainText(/access|key|unauthorized|設定|認証/i);
    await expect(page.getByTestId('sample-result')).not.toContainText('provider="replay"');
  });

  test('cancelled batch reports cancellation without applying stale output', async ({ page }) => {
    await page.route('**/api/runs', async route => { await new Promise(resolve => setTimeout(resolve, 250)); await route.continue(); });
    await page.goto('/pocs/accounting-category/eval');
    await page.getByRole('button', { name: 'Start batch' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('eval-status')).toHaveText('canceled');
    await expect(page.getByTestId('metrics')).not.toBeVisible();
  });

  test('Runtime Lab supports step, pause, and trace replay', async ({ page }) => {
    await page.goto('/runtime-lab');
    await page.getByRole('button', { name: '1 step' }).click();
    await expect(page.getByTestId('runtime-status')).toHaveText('running');
    await expect(page.getByTestId('runtime-trace')).toContainText('apply');
    await page.getByRole('button', { name: '一時停止' }).click();
    await expect(page.getByTestId('runtime-status')).toHaveText('paused');
    await page.getByRole('button', { name: 'Replay trace' }).click();
    await expect(page.getByTestId('replay-result')).toContainText('replayed');
  });

  test('Reflex Arena runs a fixed step and records a tactic trace', async ({ page }) => {
    await page.goto('/pocs/reflex-arena');
    await expect(page.getByRole('heading', { name: '判断を、盤面の上で体感する。' })).toBeVisible();
    await page.getByRole('button', { name: '1 step' }).click();
    await expect(page.getByTestId('arena-status')).toHaveText('running');
    await page.getByLabel('Tactic', { exact: true }).fill('味方を守る。');
    await page.getByRole('button', { name: '1 step' }).click();
    await expect(page.locator('.trace-list')).toContainText('lag');
  });

  test('Tiny World gameplay exposes local resident view and controls', async ({ page }) => {
    await page.goto('/pocs/tiny-world');
    await expect(page.getByRole('heading', { name: /12人の小さな世界/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Aoi resident-/ })).toBeVisible();
    await page.getByRole('button', { name: '開始 / 1 step' }).click();
    await expect(page.getByRole('heading', { name: /World map · tick 1/ })).toBeVisible();
    await page.getByRole('button', { name: 'Bram' }).click();
    await expect(page.getByText('LOCAL VIEW · Bram')).toBeVisible();
    await page.getByRole('button', { name: 'trace replay' }).click();
    await page.getByRole('combobox', { name: 'Scenario' }).selectOption('memory-loss');
    await expect(page.getByRole('button', { name: /Memory loss seed 41/ })).toBeVisible();
  });

  test('AI DJ waits for Play, changes at a bar boundary, and can replay its trace', async ({ page }) => {
    await page.goto('/pocs/ai-dj');
    await expect(page.locator('h1')).toContainText('気分の変化を');
    await expect(page.getByText('waiting for Play')).toBeVisible();
    await page.getByLabel('Mood prompt').fill('夜の移動、街の光');
    await page.getByRole('button', { name: '▶ Play' }).click();
    await expect(page.getByText('LIVE', { exact: true })).toBeVisible();
    await expect(page.locator('.dj-trace-row').first()).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: '■ Stop' }).click();
    await expect(page.getByText('READY')).toBeVisible();
    await page.getByRole('button', { name: 'Replay trace' }).click();
    await expect(page.getByText('Trace replayed visually.')).toBeVisible();
  });
});
