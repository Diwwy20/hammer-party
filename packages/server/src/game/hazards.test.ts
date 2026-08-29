import { describe, expect, it } from "vitest";
import { blastFalloff } from "./hazards";

/**
 * The meteor's damage curve. It's the only part of the storm that is a RULE rather
 * than plumbing — everything else (scheduling, spawning, broadcasting) needs a live
 * room and is covered by the e2e smoke instead.
 */
describe("blastFalloff", () => {
  const RADIUS = 4;

  it("does full damage at the impact point", () => {
    expect(blastFalloff(0, RADIUS)).toBe(1);
  });

  it("fades linearly out to the rim", () => {
    expect(blastFalloff(RADIUS / 2, RADIUS)).toBeCloseTo(0.5);
    expect(blastFalloff(RADIUS * 0.25, RADIUS)).toBeCloseTo(0.75);
  });

  it("does nothing at or beyond the rim", () => {
    expect(blastFalloff(RADIUS, RADIUS)).toBe(0);
    expect(blastFalloff(RADIUS * 3, RADIUS)).toBe(0);
  });

  it("is harmless for a degenerate blast rather than dividing by zero", () => {
    expect(blastFalloff(0, 0)).toBe(0);
  });
});
