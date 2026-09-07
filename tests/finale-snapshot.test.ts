import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetBodyIds } from "../src/physics/body";
import { makeCatalogBody } from "../src/game/catalog";
import {
  loadPersistedFinaleSnapshot,
  loadPersistedFinaleStats,
  persistFinaleSnapshot,
  persistFinaleStats,
} from "../src/game/finaleSnapshot";
import { createStats } from "../src/game/evaluation";
import { solarSystemBodies } from "../src/game/solarsystem";
import { vec3 } from "../src/physics/vec3";

describe("finale snapshot persistence", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  it("round-trips the live system through sessionStorage", () => {
    resetBodyIds();
    const bodies = solarSystemBodies();
    bodies.push(makeCatalogBody("sun", vec3(40, 0, 20)));
    persistFinaleSnapshot(bodies);
    const restored = loadPersistedFinaleSnapshot();
    expect(restored?.length).toBe(bodies.length);
    expect(restored?.filter((b) => b.kind === "sun").length).toBe(2);
    expect(restored?.some((b) => b.kind === "earth")).toBe(true);
  });

  it("persists stats alongside the snapshot", () => {
    resetBodyIds();
    const stats = createStats();
    stats.years = 42;
    stats.recent = [80, 81, 82];
    persistFinaleStats(stats);
    const restored = loadPersistedFinaleStats();
    expect(restored?.years).toBe(42);
    expect(restored?.recent).toEqual([80, 81, 82]);
  });

  it("can rehydrate a replay system from sessionStorage alone", () => {
    resetBodyIds();
    const bodies = solarSystemBodies();
    persistFinaleSnapshot(bodies);
    const hydrated = loadPersistedFinaleSnapshot();
    expect(hydrated).not.toBeNull();
    expect(hydrated!.some((b) => b.kind === "sun")).toBe(true);
    expect(hydrated!.filter((b) => b.appearance === "destroyer")).toHaveLength(0);
  });
});
