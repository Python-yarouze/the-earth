/** Simulation rate multipliers available in the watch HUD. */
export const SIM_SPEEDS = [0.5, 1, 2, 4] as const;

/** Body-POV motion is scaled down so orbits don't induce motion sickness. */
export const POV_SIM_SCALE = 0.06;

export type SimSpeed = (typeof SIM_SPEEDS)[number];

export function formatSpeed(speed: number): string {
  if (speed === 0.5) {
    return "½×";
  }
  return `${speed}×`;
}

export function parseSimSpeed(raw: string | undefined): SimSpeed | null {
  const n = Number(raw);
  return (SIM_SPEEDS as readonly number[]).includes(n) ? (n as SimSpeed) : null;
}
