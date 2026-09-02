import type { AppearanceId, Body } from "../physics/body";
import { makeCatalogBody } from "./catalog";
import { applyCircularOrbits } from "../physics/engine";
import { vec3 } from "../physics/vec3";

export interface StageDef {
  id: string;
  number: number;
  title: string;
  prompt: string;
  allowPlanets: boolean;
  maxPlanets: number;
  canMoveEarth: boolean;
  canMoveSun: boolean;
  appearances: AppearanceId[];
  sandbox: boolean;
}

export const STAGES: StageDef[] = [
  {
    id: "1",
    number: 1,
    title: "見る",
    prompt: "このままで START。軌道を眺める。",
    allowPlanets: false,
    maxPlanets: 0,
    canMoveEarth: false,
    canMoveSun: false,
    appearances: [],
    sandbox: false,
  },
  {
    id: "2",
    number: 2,
    title: "距離と高さ",
    prompt: "地球を動かす。Shift で上下。",
    allowPlanets: false,
    maxPlanets: 0,
    canMoveEarth: true,
    canMoveSun: false,
    appearances: [],
    sandbox: false,
  },
  {
    id: "3",
    number: 3,
    title: "一つ置く",
    prompt: "火星を一つ置く。",
    allowPlanets: true,
    maxPlanets: 1,
    canMoveEarth: true,
    canMoveSun: false,
    appearances: ["mars"],
    sandbox: false,
  },
  {
    id: "sandbox",
    number: 4,
    title: "自由",
    prompt: "惑星を置いて、地球のまわりのバランスを確かめる。",
    allowPlanets: true,
    maxPlanets: 10,
    canMoveEarth: true,
    canMoveSun: true,
    appearances: ["mars"],
    sandbox: true,
  },
];

export function sandboxStage(): StageDef {
  return STAGES[STAGES.length - 1];
}

export function initialBodies(_stage: StageDef): Body[] {
  const sun = makeCatalogBody("sun", vec3(0, 0, 0));
  sun.core = true;
  const earth = makeCatalogBody("earth", vec3(80, 0, 0));
  earth.core = true;
  const bodies = [sun, earth];
  applyCircularOrbits(bodies);
  return bodies;
}

export function makePlanet(appearance: AppearanceId, pos: { x: number; y: number; z: number }): Body {
  return makeCatalogBody(appearance, vec3(pos.x, pos.y, pos.z));
}

export function planetCount(bodies: readonly Body[]): number {
  return bodies.filter((b) => b.alive && b.kind === "planet" && !b.ephemeral).length;
}

export function canRemoveBody(body: Body): boolean {
  if (!body.alive || body.ephemeral || body.core) {
    return false;
  }
  return body.kind === "planet" || body.kind === "sun";
}

export function canMoveBody(stage: StageDef, body: Body): boolean {
  if (body.ephemeral || body.kind === "meteor") {
    return false;
  }
  if (body.kind === "earth") {
    return stage.canMoveEarth;
  }
  if (body.kind === "sun") {
    return stage.canMoveSun;
  }
  return true;
}

export function extraBodyCount(bodies: readonly Body[]): number {
  return bodies.filter((b) => b.alive && !b.ephemeral).length;
}
