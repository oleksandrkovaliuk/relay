import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * The Relay mark: two study cards passing, with an S-shaped channel punched
 * through them. Drawn inline and filled with `currentColor` so one asset serves
 * the dark rail, a light surface, and every per-homework tint.
 *
 * The mask id must be unique per instance — SVG ids are document-global, and a
 * repeated id makes every later copy render through the first one's mask.
 */
export function RelayMark({ size = 20, className }: { size?: number; className?: string }) {
  const maskId = useId();

  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      role="img"
      aria-label="Relay"
      className={cn("shrink-0", className)}
    >
      <mask id={maskId}>
        <rect width="256" height="256" fill="white" />
        <circle cx="58" cy="55" r="10" fill="black" />
        <path
          d="M176 98h-66c-17 0-23 17-8 25l47 24c16 8 18 24 5 35l-14 12"
          fill="none"
          stroke="black"
          strokeWidth={20}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </mask>
      <g fill="currentColor" mask={`url(#${maskId})`}>
        <path d="M52 28c-10-3-20 4-23 15L16 108c-3 14 5 27 18 31l88 26c14 4 27-4 30-18l14-64c3-13-5-25-18-29L52 28Z" />
        <path d="M105 92h72c14 0 26 8 32 21l28 64c5 13-1 27-14 32l-60 24c-12 5-25 1-33-10l-49-72c-8-12-7-27 2-39 6-7 13-15 22-20Z" />
      </g>
    </svg>
  );
}

/**
 * Mark plus wordmark. The kit sets the wordmark in Inter 650 with tight tracking,
 * which the app already loads — so it is real text here, sharp at every size and
 * selectable, rather than a bitmap of itself.
 */
export function RelayLogo({
  markSize = 20,
  className,
}: {
  markSize?: number;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <RelayMark size={markSize} className="text-primary" />
      <span className="text-[17px] font-semibold leading-none tracking-[-0.04em] text-foreground">
        Relay
      </span>
    </span>
  );
}
