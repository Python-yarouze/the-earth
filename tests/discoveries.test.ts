import { describe, expect, it } from "vitest";
import {
  appearanceFlavor,
  canSpawnComet,
  discoveryFlavor,
  evaluateDiscoveries,
} from "../src/game/discoveries";
import { defaultProgress, tickUnlocks, unlockTotal } from "../src/game/progress";

describe("discoveries", () => {
  it("records first-merge when merges counter rises", () => {
    const { progress, notices } = evaluateDiscoveries({
      ...defaultProgress(),
      merges: 1,
    });
    expect(progress.discoveries).toContain("first-merge");
    expect(notices[0]).toContain("くっつ");
  });

  it("gates comets behind shatter discovery", () => {
    expect(canSpawnComet(defaultProgress())).toBe(false);
    expect(canSpawnComet({ ...defaultProgress(), shatters: 1 })).toBe(true);
  });

  it("tickUnlocks folds discoveries into notices and totals", () => {
    const next = tickUnlocks({ ...defaultProgress(), merges: 1, shatters: 1 });
    expect(next.progress.discoveries).toContain("first-merge");
    expect(next.progress.discoveries).toContain("first-shatter");
    const { have, total } = unlockTotal(next.progress);
    expect(total).toBeGreaterThan(13);
    expect(have).toBeGreaterThan(1);
  });

  it("provides flavor text for unlocked catalog entries", () => {
    expect(appearanceFlavor("mars").length).toBeGreaterThan(8);
    expect(appearanceFlavor("takoyaki").length).toBeGreaterThan(8);
    expect(discoveryFlavor("first-merge").length).toBeGreaterThan(8);
  });
});
