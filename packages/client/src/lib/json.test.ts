import { describe, expect, it } from "vitest";
import { parseJson } from "./json";

/**
 * Standings and awards arrive as JSON blobs on the room state. They're empty for
 * most of a match, so "no data yet" has to be as ordinary as "here's the data".
 */
describe("parseJson", () => {
  it("parses a real payload", () => {
    expect(parseJson('[{"place":1,"name":"Ann"}]', [])).toEqual([{ place: 1, name: "Ann" }]);
  });

  it("returns the fallback for the empty string — the normal mid-match case", () => {
    const fallback: string[] = [];
    expect(parseJson("", fallback)).toBe(fallback);
  });

  it("returns the fallback instead of throwing on garbage", () => {
    expect(parseJson("{not json", ["x"])).toEqual(["x"]);
    expect(parseJson("[1,2", null)).toBeNull();
  });

  it("passes through valid JSON that isn't an array", () => {
    expect(parseJson('{"a":1}', {})).toEqual({ a: 1 });
    expect(parseJson("42", 0)).toBe(42);
  });
});
