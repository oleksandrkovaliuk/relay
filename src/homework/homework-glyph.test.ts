import { describe, expect, it } from "vitest";

import { homeworkGlyph } from "./homework-glyph";

describe("homeworkGlyph", () => {
  it("is stable for the same homework id", () => {
    expect(homeworkGlyph("jd7abc123")).toEqual(homeworkGlyph("jd7abc123"));
  });

  it("spreads ids across the palette instead of clustering on one hue", () => {
    const hues = new Set(
      Array.from({ length: 200 }, (_, index) => homeworkGlyph(`homework-${index}`).hue),
    );

    expect(hues.size).toBeGreaterThanOrEqual(10);
  });

  it("produces a usable oklch colour", () => {
    expect(homeworkGlyph("jd7abc123").color).toMatch(/^oklch\(0\.58 0\.12 \d+\.\d\)$/);
  });

  it("gives neighbouring ids different badges so a list stays scannable", () => {
    expect(homeworkGlyph("jd70000000000001").hue).not.toBe(
      homeworkGlyph("jd70000000000002").hue,
    );
  });
});
