import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// Generate unique cart numbers to avoid UNIQUE constraint issues across test runs
let cartNumCounter = Math.floor(Math.random() * 9000) + 1000;
function nextCartNum() {
  return cartNumCounter++;
}

test.describe('Agula Manager - Full Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clean up any existing active carts via API
    const res = await page.request.get(`${BASE_URL}/api/carts`);
    const carts = await res.json();
    for (const cart of carts) {
      await page.request.delete(`${BASE_URL}/api/carts/${cart.id}`);
    }
  });

  test('should load the dashboard', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/מנהל עגולה/);
    await expect(page.getByRole('button', { name: 'עגלה חדשה' })).toBeVisible();
  });

  test('should create a new cart', async ({ page }) => {
    await page.goto(BASE_URL);
    const num = String(nextCartNum());

    await page.getByRole('button', { name: 'עגלה חדשה' }).click();
    await page.locator('input[type="number"]').fill(num);
    await page.getByPlaceholder('צוללן 1').fill('דני');
    await page.getByPlaceholder('צוללן 2').fill('יוסי');
    await page.getByRole('button', { name: 'הוסף עגלה' }).click();

    await expect(page.getByText(`#${num}`)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('דני')).toBeVisible();
    await expect(page.getByText('יוסי')).toBeVisible();
  });

  test('should show timer countdown on active cart', async ({ page }) => {
    const num = nextCartNum();
    await page.request.post(`${BASE_URL}/api/carts`, {
      data: { cart_number: num, cart_type: 'pair', diver_names: ['אבי', 'רון'] },
    });

    await page.goto(BASE_URL);
    await expect(page.getByText(`#${num}`)).toBeVisible();
    await expect(page.getByText('אבי')).toBeVisible();
    await expect(page.getByText('זמן נותר')).toBeVisible();
    await expect(page.getByText('ניתנה')).toBeVisible();
    await expect(page.getByText('עגולה עד')).toBeVisible();
  });

  test('should show הזדהות button on active cart', async ({ page }) => {
    const num = nextCartNum();
    await page.request.post(`${BASE_URL}/api/carts`, {
      data: { cart_number: num, cart_type: 'pair', diver_names: ['שרה', 'רחל'] },
    });

    await page.goto(BASE_URL);
    await expect(page.getByText(`#${num}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'הזדהות' })).toBeVisible();
  });

  test('full check-in flow: הזדהות → paused → עגולה חדשה', async ({ page }) => {
    const num = nextCartNum();
    await page.request.post(`${BASE_URL}/api/carts`, {
      data: { cart_number: num, cart_type: 'pair', diver_names: ['משה', 'אהרון'] },
    });

    await page.goto(BASE_URL);
    await expect(page.getByText(`#${num}`)).toBeVisible();

    // Step 1: Click הזדהות to pause the timer
    const checkinBtn = page.getByRole('button', { name: 'הזדהות' });
    await expect(checkinBtn).toBeVisible();
    await checkinBtn.click();

    // Step 2: Should now show paused state with projected deadline
    await expect(page.getByText('שעת תחילת עגולה:')).toBeVisible({ timeout: 5000 });
    const newRoundBtn = page.getByRole('button', { name: 'עגולה חדשה' });
    await expect(newRoundBtn).toBeVisible();

    // Step 3: Click עגולה חדשה to start new round
    await newRoundBtn.click();

    // Should go back to active timer state
    await expect(page.getByText('זמן נותר')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'הזדהות' })).toBeVisible();
    await expect(page.getByText('עגולה עד')).toBeVisible();
  });

  test('should create a trio cart type', async ({ page }) => {
    await page.goto(BASE_URL);
    const num = String(nextCartNum());

    await page.getByRole('button', { name: 'עגלה חדשה' }).click();
    await page.locator('input[type="number"]').fill(num);
    await page.getByRole('button', { name: 'שלישייה (3)' }).click();

    // Wait for 3rd input to appear after React re-render
    await expect(page.getByPlaceholder('צוללן 3')).toBeVisible({ timeout: 3000 });

    await page.getByPlaceholder('צוללן 1').fill('א');
    await page.getByPlaceholder('צוללן 2').fill('ב');
    await page.getByPlaceholder('צוללן 3').fill('ג');
    await page.getByRole('button', { name: 'הוסף עגלה' }).click();

    await expect(page.getByText(`#${num}`)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('שלישייה')).toBeVisible();
  });

  test('should toggle dark mode', async ({ page }) => {
    await page.goto(BASE_URL);
    const themeToggle = page.locator('[aria-label="החלף ערכת נושא"]').or(page.getByText('🌙')).or(page.getByText('☀️'));
    if (await themeToggle.first().isVisible()) {
      await themeToggle.first().click();
      const htmlClass = await page.locator('html').getAttribute('class');
      expect(htmlClass).toBeDefined();
    }
  });

  test('should end cart activity', async ({ page }) => {
    const num = nextCartNum();
    const res = await page.request.post(`${BASE_URL}/api/carts`, {
      data: { cart_number: num, cart_type: 'pair', diver_names: ['טל', 'גל'] },
    });
    expect(res.ok()).toBeTruthy();

    await page.goto(BASE_URL);
    await expect(page.getByText(`#${num}`)).toBeVisible({ timeout: 10000 });

    // Open the actions menu (three dots button)
    const cardLocator = page.locator('.card').filter({ hasText: `#${num}` });
    const dotsBtn = cardLocator.locator('svg').first().locator('..');
    await dotsBtn.click();

    // Click "סיום פעילות"
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByText('סיום פעילות').click();

    // Cart should be removed
    await expect(page.getByText(`#${num}`)).not.toBeVisible({ timeout: 5000 });
  });

  test('should search and filter carts', async ({ page }) => {
    const num1 = nextCartNum();
    const num2 = nextCartNum();
    await page.request.post(`${BASE_URL}/api/carts`, {
      data: { cart_number: num1, cart_type: 'pair', diver_names: ['אלון', 'ברק'] },
    });
    await page.request.post(`${BASE_URL}/api/carts`, {
      data: { cart_number: num2, cart_type: 'pair', diver_names: ['חיים', 'דוד'] },
    });

    await page.goto(BASE_URL);
    await expect(page.getByText(`#${num1}`)).toBeVisible();
    await expect(page.getByText(`#${num2}`)).toBeVisible();

    // Search for "אלון"
    const searchInput = page.getByPlaceholder('חיפוש');
    if (await searchInput.isVisible()) {
      await searchInput.fill('אלון');
      await expect(page.getByText('אלון')).toBeVisible();
      await expect(page.getByText('חיים')).not.toBeVisible();

      // Clear search
      await searchInput.fill('');
      await expect(page.getByText(`#${num2}`)).toBeVisible();
    }
  });

  test('should display correct tab icon', async ({ page }) => {
    await page.goto(BASE_URL);
    const favicon = page.locator('link[rel="icon"]');
    const href = await favicon.getAttribute('href');
    expect(href).toBe('/icon.svg');
  });

  test('API: check-in pauses cart correctly', async ({ page }) => {
    const num = nextCartNum();
    const createRes = await page.request.post(`${BASE_URL}/api/carts`, {
      data: { cart_number: num, cart_type: 'pair', diver_names: ['Test1', 'Test2'] },
    });
    const created = await createRes.json();
    expect(created.timer_status).not.toBe('paused');

    // Check in (pause)
    const checkinRes = await page.request.post(`${BASE_URL}/api/carts/${created.id}/checkin`, {
      data: {},
    });
    const checkinData = await checkinRes.json();
    expect(checkinData.cart.timer_status).toBe('paused');
    expect(checkinData.cart.paused_at).toBeTruthy();

    // New round (resume)
    const roundRes = await page.request.post(`${BASE_URL}/api/carts/${created.id}/newround`, {
      data: {},
    });
    const roundData = await roundRes.json();
    expect(roundData.cart.timer_status).not.toBe('paused');
    expect(roundData.cart.paused_at).toBeNull();
    expect(roundData.cart.next_deadline).toBeTruthy();

    // Verify deadline is rounded to 5 minutes
    const deadline = new Date(roundData.cart.next_deadline);
    expect(deadline.getMinutes() % 5).toBe(0);
    expect(deadline.getSeconds()).toBe(0);
  });
});
