import { describe, expect, it } from "vitest";
import { makeCatalogBody } from "../src/game/catalog";
import {
  applyDestroyerGravity,
  createFinale,
  prepareFinaleScene,
  resolveFinaleCollisions,
  spawnDestroyer,
  stabilizeFinaleSun,
  tickFinale,
} from "../src/game/finale";
import { solarSystemBodies } from "../src/game/solarsystem";
import { resetBodyIds } from "../src/physics/body";
import { DT, G } from "../src/physics/constants";
import { stepFinale } from "../src/physics/engine";
import { vec3 } from "../src/physics/vec3";

function alivePlanets(bodies: ReturnType<typeof solarSystemBodies>) {
  return bodies.filter(
    (b) => b.alive && !b.ephemeral && b.appearance !== "destroyer" && b.kind !== "sun",
  );
}

function runFinaleFrames(bodies: ReturnType<typeof solarSystemBodies>, frames: number) {
  const state = createFinale();
  state.active = true;
  const destroyer = spawnDestroyer(bodies);
  bodies.push(destroyer);
  state.destroyerId = destroyer.id;
  prepareFinaleScene(bodies, destroyer, state);

  for (let frame = 0; frame < frames; frame++) {
    const dt = 1 / 60;
    let steps = 0;
    let acc = dt;
    while (acc >= DT && steps < 8) {
      stabilizeFinaleSun(bodies, state);
      acc -= DT;
      steps += 1;
      stepFinale(bodies, DT, G);
      stabilizeFinaleSun(bodies, state);
      resolveFinaleCollisions(bodies, state);
    }
    const d = bodies.find((b) => b.id === state.destroyerId && b.alive);
    tickFinale(state, dt, d);
    if (d) {
      applyDestroyerGravity(bodies, d, state, dt, G);
    }
  }
  return state;
}

describe("finale simulation", () => {
  it("keeps most planets alive during the first seconds of the finale", () => {
    resetBodyIds();
    const bodies = solarSystemBodies();
    bodies.push(makeCatalogBody("sun", vec3(50, 0, 30)));
    const atStart = alivePlanets(bodies).length;
    expect(atStart).toBeGreaterThan(5);

    runFinaleFrames(bodies, 60 * 5);
    const after5s = alivePlanets(bodies).length;
    expect(after5s).toBeGreaterThan(atStart * 0.5);
  });
});
