import { getDatabase } from '../db/database';
import type { DiveSettings } from '../../../shared/types';
import { DEFAULT_DIVE_SETTINGS } from '../../../shared/types';

/** Parse a settings JSON string from the DB, merging with defaults. */
export function parseDiveSettings(raw: string | null | undefined): DiveSettings {
  if (!raw) return { ...DEFAULT_DIVE_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return {
      agula_period_minutes: parsed.agula_period_minutes ?? DEFAULT_DIVE_SETTINGS.agula_period_minutes,
      warning_minutes: parsed.warning_minutes ?? DEFAULT_DIVE_SETTINGS.warning_minutes,
      overdue_checklist: Array.isArray(parsed.overdue_checklist) ? parsed.overdue_checklist : DEFAULT_DIVE_SETTINGS.overdue_checklist,
    };
  } catch {
    return { ...DEFAULT_DIVE_SETTINGS };
  }
}

/** Get settings for the current active dive. */
export function getActiveDiveSettings(): DiveSettings {
  const db = getDatabase();
  const row = db.prepare("SELECT settings FROM dives WHERE status = 'active' ORDER BY id DESC LIMIT 1").get() as { settings: string } | undefined;
  return parseDiveSettings(row?.settings);
}

/** Get settings for a specific dive by ID. */
export function getDiveSettingsById(diveId: number): DiveSettings {
  const db = getDatabase();
  const row = db.prepare('SELECT settings FROM dives WHERE id = ?').get(diveId) as { settings: string } | undefined;
  return parseDiveSettings(row?.settings);
}

/** Get settings for the dive that a given cart belongs to. */
export function getDiveSettingsForCart(cartId: number): DiveSettings {
  const db = getDatabase();
  const cart = db.prepare('SELECT dive_id FROM carts WHERE id = ?').get(cartId) as { dive_id: number | null } | undefined;
  if (!cart?.dive_id) return getActiveDiveSettings();
  return getDiveSettingsById(cart.dive_id);
}
