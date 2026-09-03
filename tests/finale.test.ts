import { describe, expect, it } from "vitest";
import { createBody, resetBodyIds } from "../src/physics/body";
import {
  applyDestroyerGravity,
  computeFinaleApproachDir,
  CREDIT_SECTIONS,
  EPILOGUE_LINE_SEC,
  FINALE_COLLISION_DELAY_SEC,
  FINALE_EPILOGUE_LINES,
  createFinale,
  creditsScrollDurationSec,
  creditsScrollEndPct,
  finaleCreditsPhase,
  finaleEpilogueFrame,
  finaleEpilogueTotalSec,
  finaleThanksStartSec,
  prepareFinaleScene,
  resolveFinaleCollisions,
  stabilizeFinaleSun,
} from "../src/game/finale";
import { vec3 } from "../src/physics/vec3";

describe("finale collisions", () => {
  it("explodes both the destroyer and the sun on impact", () => {
    resetBodyIds();
    const destroyer = createBody({
      kind: "planet",
      appearance: "destroyer",
      mass: 12000,
      size: 2.2,
      pos: vec3(0, 0),
      vel: vec3(4, 0),
    });
    const sun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: 1000,
      pos: vec3(12, 0),
      vel: vec3(-1, 0),
    });
    sun.core = true;
    const state = createFinale();
    state.destroyerId = destroyer.id;
    state.elapsed = FINALE_COLLISION_DELAY_SEC;
    state.sunAnchor = { x: sun.pos.x, y: sun.pos.y, z: sun.pos.z };
    const event = resolveFinaleCollisions([destroyer, sun], state);
    expect(event?.kind).toBe("big-bang");
    expect(destroyer.alive).toBe(false);
    expect(sun.alive).toBe(false);
    expect(state.sunExploded).toBe(true);
    expect(state.destroyerGone).toBe(true);
    expect(state.destroyerId).toBeNull();
  });

  it("shatters extra suns without ending the destroyer run", () => {
    resetBodyIds();
    const destroyer = createBody({
      kind: "planet",
      appearance: "destroyer",
      mass: 12000,
      size: 2.2,
      pos: vec3(0, 0),
      vel: vec3(4, 0),
    });
    const coreSun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: 1000,
      pos: vec3(-200, 0, 0),
      vel: vec3(),
    });
    coreSun.core = true;
    const extraSun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: 1000,
      pos: vec3(12, 0),
      vel: vec3(-1, 0),
    });
    const state = createFinale();
    state.destroyerId = destroyer.id;
    state.elapsed = FINALE_COLLISION_DELAY_SEC;
    state.sunAnchor = { x: coreSun.pos.x, y: coreSun.pos.y, z: coreSun.pos.z };
    const event = resolveFinaleCollisions([destroyer, coreSun, extraSun], state);
    expect(event?.kind).toBe("shatter");
    expect(extraSun.alive).toBe(false);
    expect(coreSun.alive).toBe(true);
    expect(destroyer.alive).toBe(true);
    expect(state.sunExploded).toBe(false);
    expect(state.destroyerId).toBe(destroyer.id);
  });

  it("waits before the destroyer can shatter planets", () => {
    resetBodyIds();
    const destroyer = createBody({
      kind: "planet",
      appearance: "destroyer",
      mass: 12000,
      size: 2.2,
      pos: vec3(0, 0),
    });
    const mars = createBody({
      kind: "planet",
      appearance: "mars",
      mass: 4,
      pos: vec3(12, 0),
    });
    const state = createFinale();
    state.destroyerId = destroyer.id;
    state.elapsed = 0;
    expect(resolveFinaleCollisions([destroyer, mars], state)).toBeNull();
  });

  it("shatters planets only on close contact, not from the huge physics radius", () => {
    resetBodyIds();
    const destroyer = createBody({
      kind: "planet",
      appearance: "destroyer",
      mass: 12000,
      size: 2.2,
      pos: vec3(0, 0),
    });
    const mars = createBody({
      kind: "planet",
      appearance: "mars",
      mass: 4,
      pos: vec3(80, 0),
    });
    const state = createFinale();
    state.destroyerId = destroyer.id;
    state.elapsed = FINALE_COLLISION_DELAY_SEC;
    expect(resolveFinaleCollisions([destroyer, mars], state)).toBeNull();

    mars.pos.x = 12;
    const event = resolveFinaleCollisions([destroyer, mars], state);
    expect(event?.kind).toBe("shatter");
    expect(destroyer.alive).toBe(true);
    expect(mars.alive).toBe(false);
  });

  it("pins the sun in place during the finale", () => {
    resetBodyIds();
    const sun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: 1000,
      pos: vec3(3, 4, 5),
      vel: vec3(9, 8, 7),
    });
    sun.core = true;
    const destroyer = createBody({
      kind: "planet",
      appearance: "destroyer",
      mass: 12000,
      size: 2.2,
      pos: vec3(400, 0, 0),
    });
    const state = createFinale();
    prepareFinaleScene([sun, destroyer], destroyer, state);
    sun.pos.x += 20;
    sun.vel.x = 50;
    stabilizeFinaleSun([sun, destroyer], state);
    expect(sun.pos).toEqual(state.sunAnchor);
    expect(sun.vel).toEqual(vec3());
  });

  it("does not pin extra suns during the finale", () => {
    resetBodyIds();
    const coreSun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: 1000,
      pos: vec3(0, 0, 0),
      vel: vec3(),
    });
    coreSun.core = true;
    const extraSun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: 1000,
      pos: vec3(80, 0, 0),
      vel: vec3(0, 2, 0),
    });
    const destroyer = createBody({
      kind: "planet",
      appearance: "destroyer",
      mass: 12000,
      size: 2.2,
      pos: vec3(400, 0, 0),
    });
    const state = createFinale();
    prepareFinaleScene([coreSun, extraSun, destroyer], destroyer, state);
    extraSun.pos.x += 15;
    extraSun.vel.x = 7;
    stabilizeFinaleSun([coreSun, extraSun, destroyer], state);
    expect(coreSun.pos).toEqual(state.sunAnchor);
    expect(coreSun.vel).toEqual(vec3());
    expect(extraSun.pos.x).toBe(95);
    expect(extraSun.vel.x).toBe(7);
  });

  it("pulls stray planets toward the destroyer while it is still alive", () => {
    resetBodyIds();
    const destroyer = createBody({
      kind: "planet",
      appearance: "destroyer",
      mass: 12000,
      size: 2.2,
      pos: vec3(0, 0),
      vel: vec3(),
    });
    const earth = createBody({
      kind: "earth",
      appearance: "earth",
      mass: 12,
      pos: vec3(60, 0),
      vel: vec3(0, 0),
    });
    const state = createFinale();
    state.destroyerId = destroyer.id;
    state.elapsed = FINALE_COLLISION_DELAY_SEC;
    const speedBefore = Math.hypot(earth.vel.x, earth.vel.y, earth.vel.z);
    applyDestroyerGravity([destroyer, earth], destroyer, state, 1 / 60);
    const speedAfter = Math.hypot(earth.vel.x, earth.vel.y, earth.vel.z);
    expect(speedAfter).toBeGreaterThan(speedBefore);
    expect(earth.vel.x).toBeLessThan(0);
  });

  it("aims the destroyer approach through the planet cluster", () => {
    resetBodyIds();
    const sun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: 1000,
      pos: vec3(0, 0, 0),
    });
    const earth = createBody({
      kind: "earth",
      appearance: "earth",
      mass: 12,
      pos: vec3(0, 0, 120),
    });
    const dir = computeFinaleApproachDir([sun, earth], sun.pos);
    expect(dir.z).toBeGreaterThan(0.8);
  });

  it("scrolls long enough to clear the viewport at a steady speed", () => {
    const scrollSec = creditsScrollDurationSec(520, 900);
    expect(scrollSec).toBeGreaterThan(100);
    expect(creditsScrollEndPct(520, 900)).toBeLessThan(-200);
    expect(finaleCreditsPhase(scrollSec - 1, scrollSec, null)).toBe("scroll");
    expect(finaleCreditsPhase(scrollSec, scrollSec, null)).toBe("thanks");
    expect(finaleCreditsPhase(scrollSec + 5, scrollSec, null)).toBe("button");
  });
});

describe("credit sections", () => {
  it("lists creator, program, and assets without epilogue in the scroll", () => {
    expect(CREDIT_SECTIONS[0]).toMatchObject({ variant: "title", lines: ["THE EARTH"] });
    expect(CREDIT_SECTIONS.find((s) => s.label === "クリエイター")?.lines).toEqual(["FulLine"]);
    expect(CREDIT_SECTIONS.find((s) => s.label === "プログラム")?.lines).toEqual(["FulLine", "Cursor"]);
    expect(CREDIT_SECTIONS.find((s) => s.label === "フォント")?.lines).toEqual([
      "Instrument Serif / IBM Plex Sans",
    ]);
    expect(CREDIT_SECTIONS.every((s) => !s.lines.includes("そして太陽系は消滅した。"))).toBe(true);
    expect(FINALE_EPILOGUE_LINES).toEqual([
      "そして太陽系は消滅した。",
      "でも、星はまだどこかで回っている。",
    ]);
  });
});

describe("finale epilogue", () => {
  it("shows lines only after the sun explodes", () => {
    const bangAt = 40;
    expect(finaleEpilogueFrame(bangAt - 1, bangAt).visible).toBe(false);
    expect(finaleEpilogueFrame(bangAt, bangAt).visible).toBe(true);
    expect(finaleEpilogueFrame(bangAt, bangAt).lineIndex).toBe(0);
    expect(finaleEpilogueFrame(bangAt + EPILOGUE_LINE_SEC, bangAt).lineIndex).toBe(1);
    expect(finaleEpilogueFrame(bangAt + finaleEpilogueTotalSec(), bangAt).visible).toBe(false);
  });

  it("delays thanks until scroll and epilogue are both finished", () => {
    const scrollSec = 100;
    const bangAt = 90;
    const thanksStart = finaleThanksStartSec(scrollSec, bangAt);
    expect(thanksStart).toBe(bangAt + finaleEpilogueTotalSec());
    expect(finaleCreditsPhase(thanksStart - 1, scrollSec, bangAt)).toBe("epilogue");
    expect(finaleCreditsPhase(thanksStart, scrollSec, bangAt)).toBe("thanks");
  });
});
