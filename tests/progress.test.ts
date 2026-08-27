import { describe, expect, it } from "vitest";
import { REAL_PLACEABLE_IDS } from "../src/game/catalog";
import {
  CHIME_LOOP_THRESHOLD,
  EXTRA_DEFS,
  defaultProgress,
  extraHint,
  extraLabel,
  hasChime,
  hasChimeLoop,
  hasDuplicateAppearance,
  tickUnlocks,
} from "../src/game/progress";

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

  it("opens the solar preset after every real placeable is owned (fantasy not required)", () => {
    const next = tickUnlocks({
      ...defaultProgress(),
      unlocked: [...REAL_PLACEABLE_IDS],
    });
    expect(next.progress.extras).toContain("solarsystem");
    expect(next.progress.unlocked).toContain("sun");
    expect(next.progress.unlocked).not.toContain("gaming");
    expect(next.notices.some((n) => n.includes("太陽系"))).toBe(true);
  });

  it("grants time-based fantasy and keeps special gates", () => {
    const gaming = tickUnlocks({ ...defaultProgress(), watchSec: 480 });
    expect(gaming.progress.unlocked).toContain("gaming");
    const snow = tickUnlocks({ ...defaultProgress(), moonSurviveSec: 30 });
    expect(snow.progress.unlocked).toContain("snowball");
    const voided = tickUnlocks({ ...defaultProgress(), blackHoleSeen: true });
    expect(voided.progress.unlocked).toContain("voidseed");
    const sparkle = tickUnlocks({ ...defaultProgress(), shipsSeen: 1 });
    expect(sparkle.progress.unlocked).toContain("sparkle");
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

  it("grants sun when solarsystem is already owned", () => {
    const next = tickUnlocks({
      ...defaultProgress(),
      extras: ["solarsystem"],
    });
    expect(next.progress.unlocked).toContain("sun");
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