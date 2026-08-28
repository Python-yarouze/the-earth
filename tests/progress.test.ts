import { describe, expect, it } from "vitest";
import { REAL_PLACEABLE_IDS } from "../src/game/catalog";
import {
  CHIME_LOOP_THRESHOLD,
  EXTRA_DEFS,
  SUN_LONG_STABLES,
  SUN_WATCH_SEC,
  TWELVE_BODY_THRESHOLD,
  defaultProgress,
  extraHint,
  extraLabel,
  hasChime,
  hasChimeLoop,
  hasDuplicateAppearance,
  hasSolarComplete,
  tickUnlocks,
  type PostSolarBaselines,
} from "../src/game/progress";

const solarComplete = [...REAL_PLACEABLE_IDS];

function zeroBaselines(): PostSolarBaselines {
  return {
    watchSec: 0,
    sessionYears: 0,
    sunImpacts: 0,
    moonSurviveSec: 0,
    shipsSeen: 0,
    shatters: 0,
    twinBalances: 0,
    tiltedBalances: 0,
    twelveBodyBalances: 0,
    longStables: 0,
    cometSeen: 0,
  };
}

/** Solar gate open; legacy saves use zero baselines so prior progress still counts. */
function afterSolar(overrides: Record<string, unknown> = {}) {
  return {
    ...defaultProgress(),
    unlocked: [...solarComplete],
    postSolarBaselines: zeroBaselines(),
    ...overrides,
  };
}

describe("unlocks", () => {
  it("starts with mars and unlocks mercury after watching a minute", () => {
    const start = defaultProgress();
    expect(start.unlocked).toEqual(["mars"]);
    const { progress, notices, grantedAppearances } = tickUnlocks({ ...start, watchSec: 60 });
    expect(progress.unlocked).toContain("mercury");
    expect(grantedAppearances).toContain("mercury");
    expect(notices[0]).toContain("水星");
  });

  it("unlocks pluto after a long watch", () => {
    const { progress } = tickUnlocks({ ...defaultProgress(), watchSec: 2700 });
    expect(progress.unlocked).toContain("pluto");
  });

  it("opens the solar preset after every real placeable is owned without granting sun", () => {
    const next = tickUnlocks(afterSolar());
    expect(next.progress.extras).toContain("solarsystem");
    expect(next.progress.unlocked).not.toContain("sun");
    expect(next.progress.unlocked).not.toContain("gaming");
    expect(next.notices.some((n) => n.includes("太陽系"))).toBe(true);
  });

  it("does not grant fantasy before solar complete even with high session years", () => {
    const next = tickUnlocks(
      { ...defaultProgress(), unlocked: ["mars"] },
      { sessionYears: 400, realYear: 2026 },
    );
    expect(next.progress.unlocked).not.toContain("gaming");
    expect(next.progress.unlocked).not.toContain("puff");
  });

  it("grants session-year fantasy after solar complete", () => {
    const base = afterSolar();
    const puff = tickUnlocks(base, { sessionYears: 50, realYear: 2026 });
    expect(puff.progress.unlocked).toContain("puff");
    const gaming = tickUnlocks(base, { sessionYears: 400, realYear: 2026 });
    expect(gaming.progress.unlocked).toContain("gaming");
  });

  it("counts session-year fantasy only after the solar gate", () => {
    const atGate = tickUnlocks(
      { ...defaultProgress(), unlocked: [...solarComplete], watchSec: 3600 },
      { sessionYears: 400, realYear: 2026 },
    );
    expect(atGate.progress.postSolarBaselines?.sessionYears).toBe(400);
    const puff = tickUnlocks(atGate.progress, { sessionYears: 449, realYear: 2026 });
    expect(puff.progress.unlocked).not.toContain("puff");
    const puffReady = tickUnlocks(atGate.progress, { sessionYears: 450, realYear: 2026 });
    expect(puffReady.progress.unlocked).toContain("puff");
    const gaming = tickUnlocks(atGate.progress, { sessionYears: 800, realYear: 2026 });
    expect(gaming.progress.unlocked).toContain("gaming");
  });

  it("grants sun impact ladder and event gates", () => {
    const base = afterSolar();
    const brick = tickUnlocks({ ...base, sunImpacts: 10 });
    expect(brick.progress.unlocked).toContain("brick");
    const ember = tickUnlocks({ ...base, sunImpacts: 100 });
    expect(ember.progress.unlocked).toContain("ember");
    expect(ember.progress.unlocked).toContain("brick");
    const snow = tickUnlocks({ ...base, moonSurviveSec: 30 });
    expect(snow.progress.unlocked).toContain("snowball");
    const dice = tickUnlocks({ ...base, randomPlacementUsed: true });
    expect(dice.progress.unlocked).toContain("dice");
    const bubble = tickUnlocks({ ...base, solarPresetBalanced: true });
    expect(bubble.progress.unlocked).toContain("bubble");
    const sideslip = tickUnlocks({ ...base, twelveBodyBalances: 1 });
    expect(sideslip.progress.unlocked).toContain("sideslip");
  });

  it("ignores pre-gate counters for fantasy unlocks", () => {
    const gated = tickUnlocks(
      { ...defaultProgress(), unlocked: [...solarComplete], sunImpacts: 50, watchSec: 3600 },
      { sessionYears: 0, realYear: 2026 },
    );
    expect(gated.progress.postSolarBaselines?.sunImpacts).toBe(50);
    const brick = tickUnlocks(gated.progress, { sessionYears: 0, realYear: 2026 });
    expect(brick.progress.unlocked).not.toContain("brick");
    const after = tickUnlocks(
      { ...gated.progress, sunImpacts: 60 },
      { sessionYears: 0, realYear: 2026 },
    );
    expect(after.progress.unlocked).toContain("brick");
  });

  it("grants sun only after strict composite conditions", () => {
    const almost = tickUnlocks(
      afterSolar({
        watchSec: SUN_WATCH_SEC,
        twelveBodyBalances: 1,
        longStables: SUN_LONG_STABLES - 1,
      }),
    );
    expect(almost.progress.unlocked).not.toContain("sun");

    const ready = tickUnlocks(
      afterSolar({
        watchSec: SUN_WATCH_SEC,
        twelveBodyBalances: 1,
        longStables: SUN_LONG_STABLES,
      }),
    );
    expect(ready.progress.unlocked).toContain("sun");
  });

  it("counts sun unlock watch time only after the solar gate", () => {
    const gated = tickUnlocks(
      {
        ...defaultProgress(),
        unlocked: [...solarComplete],
        watchSec: SUN_WATCH_SEC,
        twelveBodyBalances: 1,
        longStables: SUN_LONG_STABLES,
      },
      { sessionYears: 0, realYear: 2026 },
    );
    expect(gated.progress.unlocked).not.toContain("sun");
    const ready = tickUnlocks(
      {
        ...gated.progress,
        watchSec: gated.progress.watchSec + SUN_WATCH_SEC,
        twelveBodyBalances: gated.progress.twelveBodyBalances + 1,
        longStables: gated.progress.longStables + SUN_LONG_STABLES,
      },
      { sessionYears: 0, realYear: 2026 },
    );
    expect(ready.progress.unlocked).toContain("sun");
  });

  it("grants earth when post-gate session years reach real year", () => {
    const next = tickUnlocks(afterSolar(), { sessionYears: 2026, realYear: 2026 });
    expect(next.progress.unlocked).toContain("earth");
    expect(next.notices.some((n) => n.includes("現代"))).toBe(true);
  });

  it("does not grant earth from pre-gate session years alone", () => {
    const gated = tickUnlocks(
      { ...defaultProgress(), unlocked: [...solarComplete], watchSec: 3600 },
      { sessionYears: 2026, realYear: 2026 },
    );
    const next = tickUnlocks(gated.progress, { sessionYears: 2026, realYear: 2026 });
    expect(next.progress.unlocked).not.toContain("earth");
  });

  it("grants chime after a twin-planet balance", () => {
    const next = tickUnlocks({ ...defaultProgress(), twinBalances: 1 });
    expect(next.progress.extras).toContain("chime");
    expect(hasChime(next.progress)).toBe(true);
    expect(next.notices.some((n) => n.includes("鳴る"))).toBe(true);
  });

  it("grants chimeLoop after enough 奏でる plays", () => {
    const early = tickUnlocks({
      ...defaultProgress(),
      extras: ["chime"],
      chimesPlayed: CHIME_LOOP_THRESHOLD - 1,
    });
    expect(hasChimeLoop(early.progress)).toBe(false);
    const next = tickUnlocks({
      ...defaultProgress(),
      extras: ["chime"],
      chimesPlayed: CHIME_LOOP_THRESHOLD,
    });
    expect(next.progress.extras).toContain("chimeLoop");
    expect(hasChimeLoop(next.progress)).toBe(true);
    expect(next.notices.some((n) => n.includes("ながせ"))).toBe(true);
  });

  it("detects duplicate appearances among lasting bodies", () => {
    expect(
      hasDuplicateAppearance([
        { alive: true, appearance: "mars" },
        { alive: true, appearance: "mars" },
      ]),
    ).toBe(true);
    expect(
      hasDuplicateAppearance([
        { alive: true, appearance: "mars" },
        { alive: true, ephemeral: true, appearance: "mars" },
        { alive: true, appearance: "venus" },
      ]),
    ).toBe(false);
  });

  it("reports solar complete when all real placeables are owned", () => {
    expect(hasSolarComplete(defaultProgress())).toBe(false);
    expect(hasSolarComplete({ ...defaultProgress(), unlocked: [...solarComplete] })).toBe(true);
  });

  it("exposes twelve body threshold constant", () => {
    expect(TWELVE_BODY_THRESHOLD).toBe(12);
  });

  it("grants zen after a long watch", () => {
    const next = tickUnlocks({ ...defaultProgress(), watchSec: 7200 });
    expect(next.progress.extras).toContain("zen");
  });

  it("exposes Japanese labels for every extra unlock", () => {
    expect(EXTRA_DEFS.map((e) => e.id)).toEqual([
      "solarsystem",
      "extraSlots",
      "zen",
      "chime",
      "chimeLoop",
    ]);
    expect(extraLabel("solarsystem")).toContain("太陽系");
    expect(extraHint("chime").length).toBeGreaterThan(0);
    expect(extraLabel("chimeLoop")).toBe("ながす");
  });
});
