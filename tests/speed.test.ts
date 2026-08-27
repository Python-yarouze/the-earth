import { describe, expect, it } from "vitest";
import { formatSpeed, parseSimSpeed, SIM_SPEEDS } from "../src/game/speed";

describe("sim speed", () => {
  it("exposes the four watch rates", () => {
    expect(SIM_SPEEDS).toEqual([0.5, 1, 2, 4]);
    expect(formatSpeed(0.5)).toBe("½×");
    expect(formatSpeed(2)).toBe("2×");
  });

  it("parses only known multipliers", () => {
    expect(parseSimSpeed("2")).toBe(2);
    expect(parseSimSpeed("0.5")).toBe(0.5);
    expect(parseSimSpeed("3")).toBeNull();
    expect(parseSimSpeed(undefined)).toBeNull();
  });
});
