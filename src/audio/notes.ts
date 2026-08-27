import type { Body } from "../physics/body";

/** C major scale frequencies around C3–C6. */
const C_MAJOR = [
  130.81, 146.83, 164.81, 174.61, 196.0, 220.0, 246.94, // C3–B3
  261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, // C4–B4
  523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, // C5–B5
  1046.5,
];

function snapToScale(freq: number): number {
  let best = C_MAJOR[0]!;
  let bestDist = Math.abs(Math.log(freq / best));
  for (const f of C_MAJOR) {
    const d = Math.abs(Math.log(freq / f));
    if (d < bestDist) {
      best = f;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Heavier → lower pitch, lighter → higher. Size nudges a little.
 * No appearance lookup table — feel it out by placing stones.
 */
export function freqForBody(body: Pick<Body, "mass" | "size" | "kind">): number {
  const mass = Math.max(0.002, body.mass);
  // Map log-mass from ~0.002..1500 onto a continuous pitch band, then snap.
  const t = (Math.log(mass) - Math.log(0.002)) / (Math.log(1500) - Math.log(0.002));
  const clamped = Math.min(1, Math.max(0, t));
  // Invert: heavy (t→1) → low freq.
  const sizeNudge = Math.log(Math.max(0.2, body.size)) * 0.04;
  const raw = 90 * Math.pow(2, (1 - clamped) * 3.6 + sizeNudge);
  return snapToScale(raw);
}
