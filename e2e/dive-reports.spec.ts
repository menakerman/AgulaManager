import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// Unique cart numbers to avoid collisions
let cartNumCounter = Math.floor(Math.random() * 9000) + 1000;
function nextCartNum() {
  return cartNumCounter++;
}

// Helper: clean up all carts and end active dive
async function cleanUp(request: any) {
  const res = await request.get(`${BASE_URL}/api/carts`);
  if (res.ok()) {
    const carts = await res.json();
    for (const cart of carts) {
      await request.delete(`${BASE_URL}/api/carts/${cart.id}`);
    }
  }
  const diveRes = await request.get(`${BASE_URL}/api/dives/active`);
  if (diveRes.ok()) {
    const dive = await diveRes.json();
    await request.post(`${BASE_URL}/api/dives/${dive.id}/end`);
  }
}

test.describe('Dive Reports - Full E2E', () => {
  // Increase timeout for this long test
  test.setTimeout(120_000);

  test('create 10 carts, start timers staggered, end some carts, end dive, verify report', async ({ page }) => {
    // --- CLEANUP ---
    await cleanUp(page.request);

    // --- START A NEW DIVE ---
    await page.goto(BASE_URL);
    await expect(page.getByPlaceholder('שם מנהל הצלילה')).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder('שם מנהל הצלילה').fill('דוד לוי');

    // Optionally set dive name
    const nameInput = page.getByPlaceholder('שם הצלילה');
    if (await nameInput.isVisible()) {
      await nameInput.fill('צלילת מבחן דוחות');
    }

    await page.getByRole('button', { name: 'התחל צלילה' }).click();
    await expect(page.getByText('מנהל צלילה: דוד לוי')).toBeVisible({ timeout: 10_000 });

    // Get dive id via API
    const diveRes = await page.request.get(`${BASE_URL}/api/dives/active`);
    expect(diveRes.ok()).toBe(true);
    const dive = await diveRes.json();
    const diveId = dive.id;

    // --- CREATE 10 CARTS VIA API ---
    const hebrewNames = [
      ['אבי', 'רון'],
      ['שרה', 'רחל'],
      ['משה', 'אהרון'],
      ['דני', 'יוסי'],
      ['טל', 'גל'],
      ['עומר', 'דור'],
      ['נועה', 'יעל'],
      ['אלון', 'ברק'],
      ['חיים', 'דוד'],
      ['תמר', 'רוני'],
    ];

    const cartNums: number[] = [];
    const cartIds: number[] = [];

    for (let i = 0; i < 10; i++) {
      const num = nextCartNum();
      cartNums.push(num);
      const createRes = await page.request.post(`${BASE_URL}/api/carts`, {
        data: {
          cart_number: num,
          cart_type: 2,
          diver_names: hebrewNames[i],
          dive_id: diveId,
        },
      });
      expect(createRes.ok()).toBe(true);
      const cart = await createRes.json();
      cartIds.push(cart.id);
    }

    // --- START TIMERS IN STAGGERED BATCHES ---
    // Batch 1: carts 0-3
    const batch1Res = await page.request.post(`${BASE_URL}/api/carts/start-timers`, {
      data: { cart_ids: cartIds.slice(0, 4) },
    });
    expect(batch1Res.ok()).toBe(true);

    // Small delay to create time difference
    await page.waitForTimeout(1500);

    // Batch 2: carts 4-6
    const batch2Res = await page.request.post(`${BASE_URL}/api/carts/start-timers`, {
      data: { cart_ids: cartIds.slice(4, 7) },
    });
    expect(batch2Res.ok()).toBe(true);

    await page.waitForTimeout(1500);

    // Batch 3: carts 7-9
    const batch3Res = await page.request.post(`${BASE_URL}/api/carts/start-timers`, {
      data: { cart_ids: cartIds.slice(7, 10) },
    });
    expect(batch3Res.ok()).toBe(true);

    // --- VERIFY ALL 10 CARTS SHOW ON DASHBOARD ---
    await page.goto(BASE_URL);
    for (let i = 0; i < 10; i++) {
      await expect(page.getByText(`#${cartNums[i]}`)).toBeVisible({ timeout: 10_000 });
    }

    // --- DO SOME CHECK-INS ---
    // Check-in carts 0,1,2
    for (const id of cartIds.slice(0, 3)) {
      const checkinRes = await page.request.post(`${BASE_URL}/api/carts/${id}/checkin`, {
        data: { location: 'שוניות' },
      });
      expect(checkinRes.ok()).toBe(true);

      // Start new round immediately
      const roundRes = await page.request.post(`${BASE_URL}/api/carts/${id}/newround`, {
        data: {},
      });
      expect(roundRes.ok()).toBe(true);
    }

    // --- CREATE AN EVENT on cart 5 ---
    const eventRes = await page.request.post(`${BASE_URL}/api/events`, {
      data: {
        cart_id: cartIds[5],
        event_type: 'warning',
        notes: 'בדיקת אזהרה',
      },
    });
    expect(eventRes.ok()).toBe(true);
    const event = await eventRes.json();

    // Resolve the event
    const resolveRes = await page.request.put(`${BASE_URL}/api/events/${event.id}`, {
      data: { status: 'resolved' },
    });
    expect(resolveRes.ok()).toBe(true);

    // Create another event on cart 8 (leave open)
    const event2Res = await page.request.post(`${BASE_URL}/api/events`, {
      data: {
        cart_id: cartIds[8],
        event_type: 'emergency',
        notes: 'אירוע חירום לבדיקה',
      },
    });
    expect(event2Res.ok()).toBe(true);

    // --- END SOME CARTS (0,1,2,3,4) ---
    for (const id of cartIds.slice(0, 5)) {
      const endRes = await page.request.post(`${BASE_URL}/api/carts/${id}/end`);
      expect(endRes.ok()).toBe(true);
    }

    // Small delay
    await page.waitForTimeout(500);

    // --- END THE DIVE ---
    // Reload to get fresh UI state
    await page.goto(BASE_URL);
    await expect(page.getByText('סיים צלילה')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'סיים צלילה' }).click();

    // Confirm dialog
    await expect(page.getByText('כל העגלות הפעילות יסתיימו')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'סיים צלילה' }).last().click();

    // Should return to DiveGate
    await expect(page.getByPlaceholder('שם מנהל הצלילה')).toBeVisible({ timeout: 10_000 });

    // =========================================
    // ===== NOW TEST THE REPORTS PAGE =====
    // =========================================

    // Navigate to reports
    await page.getByRole('link', { name: /דוחות/ }).click();
    await expect(page.getByText('דוחות צלילה')).toBeVisible({ timeout: 10_000 });

    // --- VERIFY DIVE LIST ---
    // Find our specific dive card (first one matching, since list is sorted by most recent)
    const diveCard = page.locator('button.card').filter({ hasText: 'דוד לוי' }).filter({ hasText: 'צלילת מבחן דוחות' }).first();
    await expect(diveCard).toBeVisible({ timeout: 10_000 });

    // Should show "נחתם" badge inside our card
    await expect(diveCard.getByText('נחתם')).toBeVisible();

    // Verify cart count shows 10
    await expect(diveCard.getByText('10')).toBeVisible();

    // Click into the dive detail
    await diveCard.click();

    // --- VERIFY DIVE DETAIL HEADER ---
    await expect(page.getByText('חזרה לרשימת דוחות')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('דוד לוי').first()).toBeVisible();
    await expect(page.getByText('נחתם').first()).toBeVisible();

    // --- VERIFY SUMMARY STATS ---
    // Should show 10 carts
    const statCards = page.locator('.card.p-4.text-center');
    // Cart count should be present somewhere
    await expect(page.getByText('עגלות').first()).toBeVisible();
    await expect(page.getByText('הזדהויות').first()).toBeVisible();
    await expect(page.getByText('אירועים').first()).toBeVisible();

    // --- VERIFY TIMELINE TAB (default) ---
    const timelineTab = page.getByRole('button', { name: 'ציר זמן' });
    await expect(timelineTab).toBeVisible();
    // Timeline should be active by default
    await expect(page.getByText('צלילה התחילה')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('צלילה הסתיימה')).toBeVisible();

    // Should see cart additions in timeline
    await expect(page.getByText(/עגלה.*נוספה/).first()).toBeVisible();

    // Should see checkins in timeline
    await expect(page.getByText(/הזדהות/).first()).toBeVisible();

    // Should see events in timeline
    await expect(page.getByText(/אירוע.*נפתח/).first()).toBeVisible();

    // Should see cart endings in timeline
    await expect(page.getByText(/סיימה/).first()).toBeVisible();

    // --- VERIFY CARTS TAB ---
    await page.getByRole('button', { name: 'עגלות' }).click();

    // Should see all 10 cart numbers in the table
    for (let i = 0; i < 10; i++) {
      await expect(page.getByText(`${cartNums[i]}`).first()).toBeVisible({ timeout: 5_000 });
    }

    // All carts should show "הושלם" status (dive ended = all carts ended)
    const tableBody = page.locator('tbody');
    const completedBadges = tableBody.locator('text=הושלם');
    const badgeCount = await completedBadges.count();
    expect(badgeCount).toBe(10);

    // --- VERIFY EVENTS TAB ---
    // Use the tab bar button (border-b-2 tab)
    const eventsTabBtn = page.locator('button').filter({ hasText: 'אירועים' }).locator('visible=true');
    // The events tab button is inside the tab bar (border-b dark:border-gray-700)
    const tabBar = page.locator('.border-b.dark\\:border-gray-700');
    await tabBar.getByText('אירועים').click();

    // Should see the two events
    await expect(page.getByText('אזהרה').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('חירום').first()).toBeVisible();

    // The resolved event should show "נסגר"
    await expect(page.getByText('נסגר').first()).toBeVisible();

    // --- VERIFY EXPORT BUTTONS EXIST (completed dive) ---
    await expect(page.getByRole('button', { name: /CSV/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Excel/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /PDF/ })).toBeVisible();

    // --- GO BACK TO LIST ---
    await page.getByText('חזרה לרשימת דוחות').click();
    await expect(page.getByText('דוחות צלילה')).toBeVisible({ timeout: 5_000 });

    // --- VERIFY API ENDPOINTS DIRECTLY ---
    // GET /api/reports/dives
    const reportsRes = await page.request.get(`${BASE_URL}/api/reports/dives`);
    expect(reportsRes.ok()).toBe(true);
    const reports = await reportsRes.json();
    const ourReport = reports.find((r: any) => r.dive.id === diveId);
    expect(ourReport).toBeTruthy();
    expect(ourReport.cart_count).toBe(10);
    expect(ourReport.checkin_count).toBeGreaterThanOrEqual(3); // We did 3 check-ins
    expect(ourReport.event_count).toBe(2);
    expect(ourReport.duration_minutes).not.toBeNull();
    expect(ourReport.dive.status).toBe('completed');

    // GET /api/reports/dives/:id
    const detailRes = await page.request.get(`${BASE_URL}/api/reports/dives/${diveId}`);
    expect(detailRes.ok()).toBe(true);
    const detail = await detailRes.json();
    expect(detail.carts).toHaveLength(10);
    expect(detail.events).toHaveLength(2);
    expect(detail.timeline.length).toBeGreaterThan(0);

    // Verify timeline is sorted chronologically
    for (let i = 1; i < detail.timeline.length; i++) {
      const prev = new Date(detail.timeline[i - 1].timestamp).getTime();
      const curr = new Date(detail.timeline[i].timestamp).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }

    // Verify timeline has expected entry types
    const timelineTypes = detail.timeline.map((t: any) => t.type);
    expect(timelineTypes).toContain('dive_start');
    expect(timelineTypes).toContain('dive_end');
    expect(timelineTypes).toContain('cart_start');
    expect(timelineTypes).toContain('cart_end');
    expect(timelineTypes).toContain('checkin');
    expect(timelineTypes).toContain('event_open');
    expect(timelineTypes).toContain('event_resolve');

    // Verify summary
    expect(detail.summary.cart_count).toBe(10);
    expect(detail.summary.checkin_count).toBeGreaterThanOrEqual(3);
    expect(detail.summary.event_count).toBe(2);
    expect(detail.summary.events_by_type.warning).toBe(1);
    expect(detail.summary.events_by_type.emergency).toBe(1);

    // Verify carts have correct data
    for (const cart of detail.carts) {
      expect(cart.status).toBe('completed');
      expect(cart.ended_at).not.toBeNull();
      expect(cart.diver_names).toHaveLength(2);
    }

    // Check-in counts for first 3 carts should be >= 2 (initial start + our check-in round)
    const firstThreeCarts = detail.carts
      .filter((c: any) => cartNums.slice(0, 3).includes(c.cart_number));
    for (const c of firstThreeCarts) {
      expect(c.checkin_count).toBeGreaterThanOrEqual(2);
    }

    // GET /api/reports/dives/:id/export (CSV)
    const csvRes = await page.request.get(`${BASE_URL}/api/reports/dives/${diveId}/export`);
    expect(csvRes.ok()).toBe(true);
    const csvText = await csvRes.text();
    expect(csvText).toContain('פרטי צלילה');
    expect(csvText).toContain('דוד לוי');
    expect(csvText).toContain('עגלות');
    expect(csvText).toContain('אירועים');
  });
});
