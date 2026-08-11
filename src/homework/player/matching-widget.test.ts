import { describe, expect, it } from "vitest";

import { createMatchPath, getMatchColor } from "./matching-widget";

describe("matching connector presentation", () => {
  it("gives every pair in a large question a deterministic, unique color", () => {
    const colors = Array.from({ length: 24 }, (_, pairIndex) => getMatchColor(pairIndex, 24));

    expect(new Set(colors).size).toBe(colors.length);
    expect(getMatchColor(7, 10)).toBe(getMatchColor(7, 10));
    expect(colors.every((color) => /^oklch\(0\.58 0\.13 \d+\.\d\)$/.test(color))).toBe(true);
  });

  it("starts the palette on the accent green so the first pair matches the brand", () => {
    expect(getMatchColor(0, 8)).toBe("oklch(0.58 0.13 154.0)");
  });

  it("draws one symmetric curve that keeps the exact endpoints", () => {
    const path = createMatchPath({ x: 10, y: 20 }, { x: 210, y: 92 });

    expect(path).toMatch(/^M 10\.00 20\.00 C /);
    expect(path).toMatch(/210\.00 92\.00$/);
    expect(path.match(/ C /g)).toHaveLength(1);
  });

  it("leaves and arrives horizontally so connectors never wobble", () => {
    const path = createMatchPath({ x: 0, y: 0 }, { x: 200, y: 80 });
    const [, firstControlY, , secondControlY] =
      path.match(/C (\S+) (\S+), (\S+) (\S+),/)?.slice(1) ?? [];

    expect(firstControlY).toBe("0.00");
    expect(secondControlY).toBe("80.00");
  });

  it("keeps the control offset inside its bounds for very short and very long hops", () => {
    const shortHop = readFirstControlX(createMatchPath({ x: 0, y: 0 }, { x: 8, y: 0 }));
    const longHop = readFirstControlX(createMatchPath({ x: 0, y: 0 }, { x: 4000, y: 0 }));

    expect(shortHop).toBe(24);
    expect(longHop).toBe(120);
  });

  it("bends backwards connectors away from the source instead of through it", () => {
    const backwards = readFirstControlX(createMatchPath({ x: 300, y: 0 }, { x: 100, y: 0 }));

    expect(backwards).toBeLessThan(300);
  });
});

function readFirstControlX(path: string) {
  return Number(path.match(/C (\S+) /)?.[1]);
}
