import { describe, expect, it } from "vitest";
import { MODEL, MODEL_CLIP } from "../config/view";
import { locomotionClip, locomotionTimeScale } from "./locomotion";

describe("locomotionClip", () => {
  it("stands still below the idle threshold", () => {
    expect(locomotionClip(0)).toBe(MODEL_CLIP.Idle);
    expect(locomotionClip(MODEL.idleAboveSpeed)).toBe(MODEL_CLIP.Idle);
  });

  it("walks between the two thresholds", () => {
    expect(locomotionClip(MODEL.idleAboveSpeed + 0.01)).toBe(MODEL_CLIP.Walk);
    expect(locomotionClip(MODEL.runAboveSpeed)).toBe(MODEL_CLIP.Walk);
  });

  it("runs above the run threshold", () => {
    expect(locomotionClip(MODEL.runAboveSpeed + 0.01)).toBe(MODEL_CLIP.Run);
    expect(locomotionClip(50)).toBe(MODEL_CLIP.Run);
  });

  it("never returns a moving clip for a nonsense speed", () => {
    // an interpolation buffer with one sample in it can hand back a NaN speed, and
    // a character skating on the spot is worse than one standing still
    expect(locomotionClip(Number.NaN)).toBe(MODEL_CLIP.Idle);
    expect(locomotionClip(-3)).toBe(MODEL_CLIP.Idle);
  });
});

describe("locomotionTimeScale", () => {
  it("leaves the idle clip alone", () => {
    expect(locomotionTimeScale(MODEL_CLIP.Idle, 0)).toBe(1);
    expect(locomotionTimeScale(MODEL_CLIP.Idle, 99)).toBe(1);
  });

  it("plays a clip at 1 when the body travels at the speed it was authored for", () => {
    expect(locomotionTimeScale(MODEL_CLIP.Walk, MODEL.walkClipSpeed)).toBeCloseTo(1);
    expect(locomotionTimeScale(MODEL_CLIP.Run, MODEL.runClipSpeed)).toBeCloseTo(1);
  });

  it("speeds the clip up as the body outruns it, and slows it as the body dawdles", () => {
    expect(locomotionTimeScale(MODEL_CLIP.Walk, MODEL.walkClipSpeed * 1.3)).toBeGreaterThan(1);
    expect(locomotionTimeScale(MODEL_CLIP.Walk, MODEL.walkClipSpeed * 0.8)).toBeLessThan(1);
  });

  it("clamps both ends, so a knockback shove never fast-forwards the legs", () => {
    expect(locomotionTimeScale(MODEL_CLIP.Walk, 40)).toBe(MODEL.maxTimeScale);
    expect(locomotionTimeScale(MODEL_CLIP.Walk, 0.001)).toBe(MODEL.minTimeScale);
  });

  it("falls back to 1 rather than NaN when the speed is nonsense", () => {
    expect(locomotionTimeScale(MODEL_CLIP.Walk, Number.NaN)).toBe(1);
  });
});
