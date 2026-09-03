import { describe, expect, it } from "vitest";
import { createBody, resetBodyIds } from "../src/physics/body";
import {
  applyDestroyerGravity,
  computeFinaleApproachDir,
  CREDIT_SECTIONS,
  DESTROYER_RUSH_HANDOFF_DIST,
  DESTROYER_RUSH_SEC,
  DESTROYER_SPAWN_DIST,
  destroyerRushDistance,
  destroyerSlowSpeed,
  EPILOGUE_DELAY_SEC,
  EPILOGUE_LINE_SEC,
  FINALE_COLLISION_DELAY_SEC,
  FINALE_EPILOGUE_LINES,
  FINALE_PLANET_CONTACT_SCALE,
  FINALE_SUN_WINDUP_SEC,
  finaleHitRadius,
  finaleSunWindupShake,
  createFinale,
  CREDITS_SCROLL_DELAY_SEC,
  creditsScrollDurationSec,
  creditsScrollEndPct,
  finaleCreditsPhase,
  finaleCreditsScrollEndSec,
  finaleEpilogueFrame,
  finaleEpilogueTotalSec,
  finaleThanksStartSec,
  prepareFinaleScene,
  resolveFinaleCollisions,
  stabilizeFinaleSun,
  tickFinale,
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
    expect(resolveFinaleCollisions([destroyer, sun], state)).toBeNull();
    expect(state.sunContactAt).toBe(FINALE_COLLISION_DELAY_SEC);
    state.elapsed = FINALE_COLLISION_DELAY_SEC + FINALE_SUN_WINDUP_SEC + 0.05;
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

  it("shatters planets slightly inward of the visible surface into fine debris", () => {
    resetBodyIds();
    const destroyer = createBody({
      kind: "planet",
      appearance: "destroyer",
      mass: 12000,
      size: 5,
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
    const hitAt = (finaleHitRadius(destroyer) + finaleHitRadius(mars)) * FINALE_PLANET_CONTACT_SCALE;
    mars.pos.x = hitAt + 8;
    expect(resolveFinaleCollisions([destroyer, mars], state)).toBeNull();

    mars.pos.x = hitAt - 2;
    const bodies = [destroyer, mars];
    const event = resolveFinaleCollisions(bodies, state);
    expect(event?.kind).toBe("shatter");
    expect(destroyer.alive).toBe(true);
    expect(mars.alive).toBe(false);
    const debris = bodies.filter((x) => x.ephemeral);
    expect(debris.length).toBeGreaterThanOrEqual(10);
    expect(debris.every((x) => x.size < 0.2)).toBe(true);
  });

  it("ramps a gentle shake during the sun-contact wind-up", () => {
    const state = createFinale();
    expect(finaleSunWindupShake(state)).toBe(0);
    state.sunContactAt = 10;
    state.elapsed = 10.2;
    expect(finaleSunWindupShake(state)).toBeGreaterThan(0);
    expect(finaleSunWindupShake(state)).toBeLessThan(0.35);
    state.elapsed = 10 + FINALE_SUN_WINDUP_SEC * 0.95;
    expect(finaleSunWindupShake(state)).toBeGreaterThan(0.5);
    state.sunExploded = true;
    expect(finaleSunWindupShake(state)).toBe(0);
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
    const end = CREDITS_SCROLL_DELAY_SEC + scrollSec;
    expect(finaleCreditsPhase(CREDITS_SCROLL_DELAY_SEC - 0.1, scrollSec, null)).toBe("scroll");
    expect(finaleCreditsPhase(end - 1, scrollSec, null)).toBe("scroll");
    expect(finaleCreditsPhase(end, scrollSec, null)).toBe("thanks");
    expect(finaleCreditsPhase(end + 5, scrollSec, null)).toBe("button");
  });

  it("waits a few seconds after BGM before the credits roll matters for phase end", () => {
    expect(CREDITS_SCROLL_DELAY_SEC).toBe(5);
    expect(finaleCreditsScrollEndSec(100)).toBe(105);
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
  it("shows lines only after a quiet beat past the bang", () => {
    const bangAt = 40;
    expect(finaleEpilogueFrame(bangAt - 1, bangAt).visible).toBe(false);
    expect(finaleEpilogueFrame(bangAt, bangAt).visible).toBe(false);
    expect(finaleEpilogueFrame(bangAt + EPILOGUE_DELAY_SEC - 0.05, bangAt).visible).toBe(false);
    expect(finaleEpilogueFrame(bangAt + EPILOGUE_DELAY_SEC + 0.05, bangAt).visible).toBe(true);
    expect(finaleEpilogueFrame(bangAt + EPILOGUE_DELAY_SEC + 0.05, bangAt).lineIndex).toBe(0);
    expect(finaleEpilogueFrame(bangAt + EPILOGUE_DELAY_SEC + EPILOGUE_LINE_SEC + 0.05, bangAt).lineIndex).toBe(1);
    expect(finaleEpilogueFrame(bangAt + finaleEpilogueTotalSec() + 0.05, bangAt).visible).toBe(false);
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

describe("destroyer approach", () => {
  it("spawns far away and rushes to the handoff distance in about 10 seconds", () => {
    resetBodyIds();
    const sun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: 1000,
      pos: vec3(0, 0, 0),
    });
    sun.core = true;
    const destroyer = createBody({
      kind: "planet",
      appearance: "destroyer",
      mass: 12000,
      size: 5,
      pos: vec3(0, 0, 0),
    });
    const state = createFinale();
    state.active = true;
    prepareFinaleScene([sun, destroyer], destroyer, state);
    const startDist = Math.hypot(
      destroyer.pos.x - state.sunAnchor.x,
      destroyer.pos.y - state.sunAnchor.y,
      destroyer.pos.z - state.sunAnchor.z,
    );
    expect(startDist).toBeCloseTo(DESTROYER_SPAWN_DIST, 5);
    expect(destroyerRushDistance(0)).toBeCloseTo(DESTROYER_SPAWN_DIST, 5);
    expect(destroyerRushDistance(DESTROYER_RUSH_SEC)).toBeCloseTo(DESTROYER_RUSH_HANDOFF_DIST, 5);

    const dt = 1 / 60;
    while (state.elapsed < DESTROYER_RUSH_SEC) {
      tickFinale(state, dt, destroyer);
    }
    const handoffDist = Math.hypot(
      destroyer.pos.x - state.sunAnchor.x,
      destroyer.pos.y - state.sunAnchor.y,
      destroyer.pos.z - state.sunAnchor.z,
    );
    expect(handoffDist).toBeCloseTo(DESTROYER_RUSH_HANDOFF_DIST, 0);
  });

  it("uses the slow approach speed band after the rush", () => {
    expect(destroyerSlowSpeed(DESTROYER_RUSH_SEC)).toBeCloseTo(2.4, 5);
    expect(destroyerSlowSpeed(DESTROYER_RUSH_SEC + 103)).toBeCloseTo(6.6, 5);
    expect(destroyerSlowSpeed(DESTROYER_RUSH_SEC + 20)).toBeGreaterThan(2.4);
    expect(destroyerSlowSpeed(DESTROYER_RUSH_SEC + 20)).toBeLessThan(6.6);
    const eps = 1 / 120;
    const endSpeed =
      (destroyerRushDistance(DESTROYER_RUSH_SEC - eps) - destroyerRushDistance(DESTROYER_RUSH_SEC)) / eps;
    expect(endSpeed).toBeGreaterThan(1.5);
    expect(endSpeed).toBeLessThan(4);
  });
});
