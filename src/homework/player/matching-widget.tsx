import { Check, ChevronDown, CornerDownRight, X } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { cn } from "@/lib/utils";
import type { WidgetMarking } from "./answer-types";

/** Green first, then evenly spaced hues so neighbouring pairs never look alike. */
const MATCH_BASE_HUE = 154;
const MINIMUM_CONTROL_OFFSET = 18;
/** Per-pair stagger of the point where a connector turns. */
const LANE_STEP = 5;
const MAXIMUM_CONTROL_OFFSET = 120;
const CONNECTOR_REVEAL_MILLISECONDS = 240;
/**
 * Under this width two columns of prose leave ~200px per side: every card turns
 * into a narrow tower of three-word lines. What matters is the room the widget
 * actually has, not the window — the teacher's preview column is as tight as a
 * phone — so the switch is measured on the container.
 */
const COMPACT_CONTAINER_WIDTH = 560;

type MatchingProps = {
  lefts: string[];
  rights: string[];
  assigned: string[];
  onChange: (rights: string[]) => void;
  isReadOnly?: boolean;
  /** Present only in review: which pairs were right, and what was expected. */
  marking?: WidgetMarking;
};

type Point = { x: number; y: number };

type ConnectorGeometry = {
  key: string;
  leftIndex: number;
  path: string;
};

type MatchEndpointStyle = CSSProperties & {
  "--match-color": string;
  "--match-text": string;
};

export function MatchingWidget(props: MatchingProps) {
  const { measureRef, isCompact } = useCompactContainer();
  // A marked answer is always the list: drawn connectors say which pair was made,
  // never whether it was right, and a wrong pair needs its expected match beside
  // it to be worth reading.
  const isList = Boolean(props.marking) || isCompact;

  return (
    <div ref={measureRef}>
      {isCompact === null && !props.marking ? null : isList ? (
        <MatchingList {...props} />
      ) : (
        <MatchingBoard {...props} />
      )}
    </div>
  );
}

/**
 * Watches the room the widget has. `null` until the first measurement, so the
 * board never renders for a frame in a column too narrow for it.
 */
function useCompactContainer() {
  const measureRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState<boolean | null>(null);

  useLayoutEffect(function trackContainerWidth() {
    const element = measureRef.current;
    if (!element) return;
    function measure() {
      setIsCompact(element!.getBoundingClientRect().width < COMPACT_CONTAINER_WIDTH);
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { measureRef, isCompact };
}

/** Two facing columns joined by drawn connectors — the desktop and tablet view. */
function MatchingBoard({ lefts, rights, assigned, onChange, isReadOnly }: MatchingProps) {
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<Point | null>(null);
  const [pointerPosition, setPointerPosition] = useState<Point | null>(null);
  const [previewedRight, setPreviewedRight] = useState<string | null>(null);
  const [newConnectorKey, setNewConnectorKey] = useState<string | null>(null);
  const [isNewConnectorRevealed, setIsNewConnectorRevealed] = useState(true);
  const instructionsId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef(new Map<number, HTMLElement>());
  const rightRefs = useRef(new Map<string, HTMLElement>());
  const latestPointerRef = useRef<Point | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const [connectors, setConnectors] = useState<ConnectorGeometry[]>([]);

  useLayoutEffect(function measureConnectorGeometry() {
    function measure() {
      const container = containerRef.current?.getBoundingClientRect();
      if (!container) return;

      setConnectors(
        assigned.flatMap((right, leftIndex) => {
          if (!right) return [];
          const leftElement = leftRefs.current.get(leftIndex);
          const rightElement = rightRefs.current.get(right);
          if (!leftElement || !rightElement) return [];
          return [
            {
              key: `${leftIndex}-${right}`,
              leftIndex,
              path: createMatchPath(
                getRightCenter(leftElement.getBoundingClientRect(), container),
                getLeftCenter(rightElement.getBoundingClientRect(), container),
                leftIndex,
              ),
            },
          ];
        }),
      );

      if (activeLeft === null) {
        setActiveAnchor(null);
        return;
      }
      const activeElement = leftRefs.current.get(activeLeft);
      setActiveAnchor(
        activeElement ? getRightCenter(activeElement.getBoundingClientRect(), container) : null,
      );
    }

    measure();
    /**
     * Every endpoint is observed, not just the container. A card that rewraps —
     * because a webfont finally loaded, or a neighbouring column reflowed —
     * changes where a connector must land without changing the container's own
     * size, which is what left connectors ending mid-gutter.
     */
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    for (const element of leftRefs.current.values()) observer.observe(element);
    for (const element of rightRefs.current.values()) observer.observe(element);
    window.addEventListener("resize", measure);
    /** Fonts land after first paint and change every card's height. */
    let isActive = true;
    void document.fonts?.ready.then(() => {
      if (isActive) measure();
    });
    return () => {
      isActive = false;
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [assigned, activeLeft, lefts, rights]);

  useEffect(function revealNewConnector() {
    if (!newConnectorKey) return;
    if (!connectors.some((connector) => connector.key === newConnectorKey)) return;

    const connectorKey = newConnectorKey;
    const revealFrame = window.requestAnimationFrame(() => setIsNewConnectorRevealed(true));
    const cleanupTimer = window.setTimeout(() => {
      setNewConnectorKey((currentKey) => (currentKey === connectorKey ? null : currentKey));
    }, CONNECTOR_REVEAL_MILLISECONDS);

    return () => {
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(cleanupTimer);
    };
  }, [connectors, newConnectorKey]);

  useEffect(function trackPointerWhileConnecting() {
    if (activeLeft === null) return;

    function updatePointer(event: PointerEvent) {
      const container = containerRef.current?.getBoundingClientRect();
      if (!container) return;
      latestPointerRef.current = {
        x: clamp(event.clientX - container.left, 0, container.width),
        y: clamp(event.clientY - container.top, 0, container.height),
      };
      if (pointerFrameRef.current !== null) return;
      pointerFrameRef.current = window.requestAnimationFrame(() => {
        pointerFrameRef.current = null;
        if (latestPointerRef.current) setPointerPosition(latestPointerRef.current);
      });
    }

    window.addEventListener("pointermove", updatePointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", updatePointer);
      if (pointerFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = null;
      }
    };
  }, [activeLeft]);

  function selectLeft(leftIndex: number, element: HTMLElement) {
    const nextActiveLeft = activeLeft === leftIndex ? null : leftIndex;
    setActiveLeft(nextActiveLeft);
    setPreviewedRight(null);
    if (nextActiveLeft === null) {
      resetConnectingState();
      return;
    }

    const container = containerRef.current?.getBoundingClientRect();
    if (!container) return;
    const anchor = getRightCenter(element.getBoundingClientRect(), container);
    setActiveAnchor(anchor);
    setPointerPosition(anchor);
    latestPointerRef.current = anchor;
  }

  function resetConnectingState() {
    setActiveAnchor(null);
    setPointerPosition(null);
    setPreviewedRight(null);
    latestPointerRef.current = null;
  }

  function connect(right: string) {
    if (activeLeft === null) return;
    if (assigned[activeLeft] !== right) {
      setNewConnectorKey(`${activeLeft}-${right}`);
      setIsNewConnectorRevealed(false);
    }
    onChange(
      assigned.map((current, index) => {
        if (index === activeLeft) return right;
        return current === right ? "" : current;
      }),
    );
    setActiveLeft(null);
    resetConnectingState();
  }

  function clear(leftIndex: number) {
    onChange(assigned.map((current, index) => (index === leftIndex ? "" : current)));
    setActiveLeft(null);
    setNewConnectorKey(null);
    resetConnectingState();
  }

  function clearPreview(right: string) {
    setPreviewedRight((currentRight) => (currentRight === right ? null : currentRight));
  }

  const activeLeftLabel = activeLeft === null ? null : lefts[activeLeft];
  const livePath =
    activeLeft !== null && activeAnchor && pointerPosition
      ? createMatchPath(activeAnchor, pointerPosition)
      : null;

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Match the pairs"
      aria-describedby={isReadOnly ? undefined : instructionsId}
      data-connecting={activeLeft !== null ? "true" : "false"}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || activeLeft === null) return;
        event.preventDefault();
        setActiveLeft(null);
        resetConnectingState();
      }}
      className="relative grid grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] gap-y-2.5 lg:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)]"
    >
      <svg
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        {connectors.map((connector) => {
          const isNewConnector = connector.key === newConnectorKey;
          return (
            <g
              key={connector.key}
              stroke={getMatchColor(connector.leftIndex, lefts.length)}
              /* New connectors fade in. They used to be revealed by animating a
                 dash offset, which draws the line progressively — and any state
                 that left the offset short of the end rendered a stub instead of
                 a connection. */
              className="match-connector"
              data-revealing={isNewConnector && !isNewConnectorRevealed ? "true" : undefined}
            >
              <path
                className="match-path-halo"
                d={connector.path}
                fill="none"
                strokeLinecap="round"
                strokeWidth={6}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={connector.path}
                fill="none"
                strokeLinecap="round"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
        {livePath && activeLeft !== null ? (
          <g stroke={getMatchColor(activeLeft, lefts.length)}>
            <path
              className="match-path-halo"
              d={livePath}
              fill="none"
              strokeLinecap="round"
              strokeWidth={9}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={livePath}
              fill="none"
              strokeDasharray="5 5"
              strokeLinecap="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : null}
      </svg>

      <div className="col-start-1 grid content-start gap-2.5">
        {lefts.map((left, index) => {
          const isActive = activeLeft === index;
          const match = assigned[index] ?? "";
          const isTinted = isActive || Boolean(match);
          return (
            <div
              key={left}
              ref={(element) => {
                if (element) leftRefs.current.set(index, element);
                else leftRefs.current.delete(index);
              }}
              style={isTinted ? getMatchEndpointStyle(index, lefts.length) : undefined}
              className={cn(
                "match-endpoint group/endpoint relative z-10 flex min-h-12 items-stretch rounded-xl border",
                isTinted
                  ? "border-(--match-color) bg-[color-mix(in_oklab,var(--match-color)_12%,var(--card))] text-(--match-text)"
                  : "border-border bg-card text-ink hover:border-input hover:bg-muted/45",
                isActive && "shadow-[0_0_0_3px_color-mix(in_oklab,var(--match-color)_22%,transparent)]",
              )}
            >
              <button
                type="button"
                disabled={isReadOnly}
                aria-pressed={isActive}
                aria-label={
                  match
                    ? `${left}, matched with ${match}. Select to change.`
                    : `${left}. Select to match.`
                }
                onClick={(event) => selectLeft(index, event.currentTarget)}
                className="match-press flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm leading-snug disabled:cursor-default lg:text-[15px]"
              >
                <span className="min-w-0 flex-1 font-medium">{left}</span>
                {match && isReadOnly ? (
                  <Check size={14} className="shrink-0" aria-hidden />
                ) : (
                  <MatchDot isTinted={isTinted} />
                )}
              </button>
              {match && !isReadOnly ? (
                <button
                  type="button"
                  aria-label={`Clear match between ${left} and ${match}`}
                  onClick={() => clear(index)}
                  className="match-press mr-1.5 grid w-8 shrink-0 place-items-center self-center rounded-lg text-current opacity-0 transition-opacity duration-150 hover:bg-current/10 focus-visible:opacity-100 group-hover/endpoint:opacity-100 motion-reduce:transition-none"
                >
                  <X size={12} aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="col-start-2" />

      <div className="col-start-3 grid content-start gap-2.5">
        {rights.map((right) => {
          const matchedLeftIndex = assigned.indexOf(right);
          const isMatched = matchedLeftIndex >= 0;
          const matchedLeft = isMatched ? lefts[matchedLeftIndex] : null;
          const isPreviewed = activeLeft !== null && previewedRight === right;
          const pairColorIndex = isPreviewed ? activeLeft : matchedLeftIndex;
          const isTinted = pairColorIndex >= 0;
          const rightLabel = activeLeftLabel
            ? `Match ${activeLeftLabel} with ${right}${matchedLeft ? `, currently matched with ${matchedLeft}` : ""}`
            : matchedLeft
              ? `${right}, matched with ${matchedLeft}`
              : right;
          return (
            <div
              key={right}
              ref={(element) => {
                if (element) rightRefs.current.set(right, element);
                else rightRefs.current.delete(right);
              }}
              className="relative z-10"
            >
              <button
                type="button"
                disabled={isReadOnly || activeLeft === null}
                aria-label={rightLabel}
                onClick={() => connect(right)}
                onPointerEnter={() => {
                  if (activeLeft !== null) setPreviewedRight(right);
                }}
                onPointerLeave={() => clearPreview(right)}
                onFocus={() => {
                  if (activeLeft !== null) setPreviewedRight(right);
                }}
                onBlur={() => clearPreview(right)}
                style={isTinted ? getMatchEndpointStyle(pairColorIndex, lefts.length) : undefined}
                className={cn(
                  "match-endpoint match-press flex min-h-12 w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm leading-snug lg:text-[15px]",
                  isTinted
                    ? "border-(--match-color) bg-[color-mix(in_oklab,var(--match-color)_12%,var(--card))] font-medium text-(--match-text)"
                    : "border-border bg-card text-ink",
                  activeLeft !== null && !isReadOnly && !isTinted && "hover:border-input hover:bg-muted/45",
                  isPreviewed && "shadow-[0_0_0_3px_color-mix(in_oklab,var(--match-color)_22%,transparent)]",
                )}
              >
                <MatchDot isTinted={isTinted} />
                <span className="min-w-0 flex-1">{right}</span>
              </button>
            </div>
          );
        })}
      </div>

      {!isReadOnly ? (
        <p
          id={instructionsId}
          aria-live="polite"
          className="col-span-3 mt-2 text-[13px] leading-5 text-ink-secondary lg:text-sm"
        >
          {activeLeft === null
            ? "Choose a word on the left, then its match on the right."
            : `Now choose the match for “${lefts[activeLeft]}”.`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The phone view: one card per prompt, each opening the list of possible matches
 * underneath it. No connectors to draw, so nothing overlaps and every tap target
 * is full width.
 */
function MatchingList({ lefts, rights, assigned, onChange, isReadOnly, marking }: MatchingProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const instructionsId = useId();

  function choose(leftIndex: number, right: string) {
    onChange(
      assigned.map((current, index) => {
        if (index === leftIndex) return right;
        // A right belongs to one prompt, so choosing it moves it here.
        return current === right ? "" : current;
      }),
    );
    setOpenIndex(null);
  }

  function clear(leftIndex: number) {
    onChange(assigned.map((current, index) => (index === leftIndex ? "" : current)));
  }

  return (
    <div
      role="group"
      aria-label="Match the pairs"
      aria-describedby={isReadOnly ? undefined : instructionsId}
      className="grid gap-2.5"
    >
      {lefts.map((left, index) => {
        const match = assigned[index] ?? "";
        const isOpen = openIndex === index;
        // The first card carries its pair colour from the start so the
        // tap-to-choose interaction reads before anything is answered.
        const mark = marking?.parts[index];
        const isTinted = !marking && (Boolean(match) || isOpen);
        return (
          <div
            key={left}
            style={isTinted ? getMatchEndpointStyle(index, lefts.length) : undefined}
            className={cn(
              "match-endpoint overflow-hidden rounded-xl border",
              isTinted
                ? "border-(--match-color) bg-[color-mix(in_oklab,var(--match-color)_10%,var(--card))] text-(--match-text)"
                : "border-border bg-card text-ink",
              mark?.isCorrect && "border-primary bg-primary-soft/40",
              mark && !mark.isCorrect && "border-destructive bg-critical-soft/50",
              isOpen && "shadow-[0_0_0_3px_color-mix(in_oklab,var(--match-color)_20%,transparent)]",
            )}
          >
            <div className="flex items-stretch">
              <button
                type="button"
                disabled={isReadOnly || Boolean(marking)}
                aria-expanded={isReadOnly || marking ? undefined : isOpen}
                aria-label={
                  match
                    ? `${left}, matched with ${match}. Select to change.`
                    : `${left}. Select to choose a match.`
                }
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="match-press flex min-w-0 flex-1 flex-col gap-1.5 px-3.5 py-3 text-left disabled:cursor-default"
              >
                <span className="flex items-start gap-2.5 text-sm font-medium leading-snug">
                  <MatchDot isTinted={isTinted} className="mt-1.5" />
                  <span className="min-w-0 flex-1">{left}</span>
                  {isReadOnly || marking ? null : (
                    <ChevronDown
                      size={15}
                      aria-hidden
                      className={cn(
                        "mt-0.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none",
                        isOpen && "rotate-180",
                      )}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "flex items-start gap-1.5 pl-5 text-[13px] leading-5",
                    match ? "font-medium" : "text-ink-muted",
                  )}
                >
                  {match ? (
                    <CornerDownRight size={13} className="mt-0.5 shrink-0" aria-hidden />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className={cn(mark && !mark.isCorrect && "text-destructive")}>
                      {match || (isReadOnly ? "No answer" : "Tap to choose the match")}
                    </span>
                    {mark && !mark.isCorrect && mark.expected ? (
                      <span className="mt-0.5 block text-primary">→ {mark.expected}</span>
                    ) : null}
                  </span>
                </span>
              </button>
              {match && !isReadOnly ? (
                <button
                  type="button"
                  aria-label={`Clear match between ${left} and ${match}`}
                  onClick={() => clear(index)}
                  className="match-press mr-2 grid size-7 shrink-0 place-items-center self-center rounded-full text-current hover:bg-current/10"
                >
                  <X size={12} aria-hidden />
                </button>
              ) : marking ? (
                // The verdict is already on the row; a tick here would contradict it.
                null
              ) : (
                match && <Check size={14} className="mr-3.5 shrink-0 self-center" aria-hidden />
              )}
            </div>

            {isOpen ? (
              <ul className="grid gap-1.5 border-t border-current/15 bg-card/55 p-2">
                {rights.map((right) => {
                  const takenBy = assigned.indexOf(right);
                  const isChosen = takenBy === index;
                  const isTakenElsewhere = takenBy >= 0 && takenBy !== index;
                  return (
                    <li key={right}>
                      <button
                        type="button"
                        aria-pressed={isChosen}
                        onClick={() => choose(index, right)}
                        className={cn(
                          "match-press flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[13.5px] leading-5",
                          isChosen
                            ? "border-(--match-color) bg-[color-mix(in_oklab,var(--match-color)_16%,var(--card))] font-medium text-(--match-text)"
                            : "border-border bg-card text-ink",
                          isTakenElsewhere && "opacity-55",
                        )}
                      >
                        <span className="min-w-0 flex-1">{right}</span>
                        {isChosen ? (
                          <Check size={14} className="mt-0.5 shrink-0" aria-hidden />
                        ) : isTakenElsewhere ? (
                          <span className="mt-px shrink-0 text-[11px] text-ink-muted">in use</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}

      {!isReadOnly && !marking ? (
        <p id={instructionsId} className="mt-1 text-[13px] leading-5 text-ink-secondary">
          Tap a sentence, then pick the rule that matches it.
        </p>
      ) : null}
    </div>
  );
}

function MatchDot({ isTinted, className }: { isTinted: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block size-2.5 shrink-0 rounded-full transition-colors duration-150",
        isTinted ? "bg-(--match-color)" : "bg-foreground/15",
        className,
      )}
    />
  );
}

function getRightCenter(element: DOMRect, container: DOMRect): Point {
  return {
    x: element.right - container.left,
    y: element.top + element.height / 2 - container.top,
  };
}

function getLeftCenter(element: DOMRect, container: DOMRect): Point {
  return {
    x: element.left - container.left,
    y: element.top + element.height / 2 - container.top,
  };
}

/**
 * One symmetric cubic curve that leaves and arrives horizontally — the same
 * shape a node graph uses. Control points scale with the gap, so a short hop
 * stays gentle and a tall one bends without looping or wobbling.
 */
export function createMatchPath(from: Point, to: Point, lane = 0) {
  const horizontalDistance = to.x - from.x;
  const verticalDistance = to.y - from.y;
  /**
   * A long horizontal run before the curve keeps two crossing pairs apart: they
   * meet at one point instead of overlapping down the whole channel. The lane
   * staggers that point per pair so even three crossings stay readable.
   */
  const controlOffset = clamp(
    Math.abs(horizontalDistance) * 0.42 + Math.abs(verticalDistance) * 0.08 + lane * LANE_STEP,
    MINIMUM_CONTROL_OFFSET,
    MAXIMUM_CONTROL_OFFSET,
  );
  const direction = horizontalDistance >= 0 ? 1 : -1;
  const firstControl = { x: from.x + controlOffset * direction, y: from.y };
  const secondControl = { x: to.x - controlOffset * direction, y: to.y };

  return [
    `M ${format(from.x)} ${format(from.y)}`,
    `C ${format(firstControl.x)} ${format(firstControl.y)},`,
    `${format(secondControl.x)} ${format(secondControl.y)},`,
    `${format(to.x)} ${format(to.y)}`,
  ].join(" ");
}

export function getMatchColor(pairIndex: number, pairCount = 10) {
  const colorCount = Math.max(1, pairCount);
  const hue = (MATCH_BASE_HUE + Math.max(0, pairIndex) * (360 / colorCount)) % 360;
  return `oklch(0.58 0.13 ${hue.toFixed(1)})`;
}

function getMatchTextColor(pairIndex: number, pairCount: number) {
  const colorCount = Math.max(1, pairCount);
  const hue = (MATCH_BASE_HUE + Math.max(0, pairIndex) * (360 / colorCount)) % 360;
  return `oklch(0.42 0.1 ${hue.toFixed(1)})`;
}

function getMatchEndpointStyle(pairIndex: number, pairCount: number): MatchEndpointStyle {
  return {
    "--match-color": getMatchColor(pairIndex, pairCount),
    "--match-text": getMatchTextColor(pairIndex, pairCount),
  };
}

function format(coordinate: number) {
  return coordinate.toFixed(2);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
