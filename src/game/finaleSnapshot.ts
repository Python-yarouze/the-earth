import type { EarthStats } from "./evaluation";
import { cloneBody, type Body } from "../physics/body";

const KEY = "the-earth-finale-snapshot";
const STATS_KEY = "the-earth-finale-stats";

export function persistFinaleSnapshot(bodies: readonly Body[]): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(bodies));
  } catch {
    /* private mode / quota */
  }
}

export function persistFinaleStats(stats: EarthStats): void {
  try {
    sessionStorage.setItem(
      STATS_KEY,
      JSON.stringify({
        ...stats,
        recent: stats.recent.slice(),
      }),
    );
  } catch {
    /* private mode / quota */
  }
}

export function loadPersistedFinaleSnapshot(): Body[] | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Body[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }
    return parsed.map(cloneBody);
  } catch {
    return null;
  }
}

export function loadPersistedFinaleStats(): EarthStats | null {
  try {
    const raw = sessionStorage.getItem(STATS_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as EarthStats;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return {
      ...parsed,
      recent: Array.isArray(parsed.recent) ? parsed.recent.slice() : [],
    };
  } catch {
    return null;
  }
}

export function clearPersistedFinaleSnapshot(): void {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(STATS_KEY);
  } catch {
    /* private mode */
  }
}
