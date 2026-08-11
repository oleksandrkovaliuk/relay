import type { CSSProperties } from "react";

import { RelayMark } from "@/components/relay-logo";
import { cn } from "@/lib/utils";

/**
 * Hues, not pictures. Every homework badge is the Relay mark, so the app looks
 * like one product; what makes a set recognisable in a list is its colour, which
 * is derived from the id and therefore permanent.
 */
const GLYPH_HUE_COUNT = 12;
const BASE_HUE = 154;

type GlyphStyle = CSSProperties & { "--glyph-color": string };

/**
 * A stable tint for one homework, derived from its id. Deterministic so a set
 * keeps the same badge forever, and derived rather than stored so it works for
 * homework that already exists.
 */
export function homeworkGlyph(id: string) {
  const hash = hashString(id);
  const hue = ((BASE_HUE + (hash % GLYPH_HUE_COUNT) * (360 / GLYPH_HUE_COUNT)) % 360).toFixed(1);
  return { color: `oklch(0.58 0.12 ${hue})`, hue: Number(hue) };
}

const GLYPH_SIZES = {
  sm: { box: "size-6 rounded-[7px]", mark: 12 },
  default: { box: "size-8 rounded-[9px]", mark: 15 },
  lg: { box: "size-12 rounded-[14px]", mark: 24 },
} as const;

export function HomeworkGlyph({
  id,
  size = "default",
  className,
}: {
  id: string;
  size?: keyof typeof GLYPH_SIZES;
  className?: string;
}) {
  const { color } = homeworkGlyph(id);
  const style: GlyphStyle = { "--glyph-color": color };
  const { box, mark } = GLYPH_SIZES[size];

  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "grid shrink-0 place-items-center border border-(--glyph-color)/25 text-(--glyph-color)",
        "bg-[color-mix(in_oklab,var(--glyph-color)_10%,var(--card))]",
        box,
        className,
      )}
    >
      <RelayMark size={mark} />
    </span>
  );
}

/** FNV-1a: small, stable across runs, and good enough to spread ids evenly. */
function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash);
}
