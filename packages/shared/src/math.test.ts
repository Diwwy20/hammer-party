import { describe, expect, it } from "vitest";
import {
  TAU,
  approach,
  clamp,
  clamp01,
  clampIndex,
  degToRad,
  lerp,
  lerpAngle,
  pointOnCircle,
} from "./math";

describe("clamp", () => {
  it("passes a value that is already inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to each bound", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe("clamp01", () => {
  it("keeps ratios inside [0, 1]", () => {
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(9)).toBe(1);
  });
});

describe("clampIndex", () => {
  // this is what stops a hostile client sending hatIndex: 999 or 2.5
  it("floors and clamps an index into a catalog", () => {
    expect(clampIndex(2.9, 0, 5)).toBe(2);
    expect(clampIndex(-4, 0, 5)).toBe(0);
    expect(clampIndex(999, 0, 5)).toBe(5);
  });
});

describe("lerp", () => {
  it("interpolates between the endpoints", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });
});

describe("lerpAngle", () => {
  it("interpolates the short way across the ±π seam", () => {
    // from just under +π to just over -π is a small step, not a full turn back
    const from = Math.PI - 0.1;
    const to = -Math.PI + 0.1;
    const half = lerpAngle(from, to, 0.5);
    // the midpoint sits on the seam itself, not back near 0
    expect(Math.abs(Math.abs(half) - Math.PI)).toBeLessThan(0.001);
  });

  it("returns the endpoints at f=0 and f=1", () => {
    expect(lerpAngle(0.3, 1.2, 0)).toBeCloseTo(0.3, 10);
    expect(lerpAngle(0.3, 1.2, 1)).toBeCloseTo(1.2, 10);
  });

  it("never travels more than half a turn", () => {
    const step = Math.abs(lerpAngle(0, TAU - 0.2, 1) - 0);
    expect(step).toBeLessThanOrEqual(Math.PI);
  });
});

describe("approach", () => {
  it("is frame-rate independent: two half-steps ≈ one whole step", () => {
    const rate = 8;
    const dt = 1 / 30;

    let twoSmall = 0;
    for (let i = 0; i < 2; i++) twoSmall += (1 - twoSmall) * approach(rate, dt / 2);
    const oneBig = (1 - 0) * approach(rate, dt);

    expect(twoSmall).toBeCloseTo(oneBig, 10);
  });

  it("stays inside (0, 1) for a positive step", () => {
    const f = approach(6, 1 / 60);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
  });
});

describe("pointOnCircle", () => {
  it("puts angle 0 on +x and a quarter turn on +z", () => {
    const [x0, z0] = pointOnCircle(0, 10);
    expect(x0).toBeCloseTo(10, 10);
    expect(z0).toBeCloseTo(0, 10);

    const [x1, z1] = pointOnCircle(TAU / 4, 10);
    expect(x1).toBeCloseTo(0, 10);
    expect(z1).toBeCloseTo(10, 10);
  });

  it("always lands on the given radius", () => {
    for (const a of [0.3, 1.7, 3.9, 5.5]) {
      const [x, z] = pointOnCircle(a, 7);
      expect(Math.hypot(x, z)).toBeCloseTo(7, 10);
    }
  });
});

describe("degToRad", () => {
  it("converts the usual landmarks", () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 10);
    expect(degToRad(90)).toBeCloseTo(Math.PI / 2, 10);
    expect(TAU).toBeCloseTo(degToRad(360), 10);
  });
});
