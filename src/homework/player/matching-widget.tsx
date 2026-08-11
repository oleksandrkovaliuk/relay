import { Check, X } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { cn } from "@/lib/utils";

/** Green first, then evenly spaced hues so neighbouring pairs never look alike. */
const MATCH_BASE_HUE = 154;
const MINIMUM_CONTROL_OFFSET = 24;
const MAXIMUM_CONTROL_OFFSET = 120;
const CONNECTOR_REVEAL_MILLISECONDS = 240;

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

export function MatchingWidget({
  lefts,
  rights,
  assigned,
  onChange,
  isReadOnly,
}: {
  lefts: string[];
  rights: string[];
  assigned: string[];
  onChange: (rights: string[]) => void;
  isReadOnly?: boolean;
}) {
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
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
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
      className="relative grid grid-cols-[minmax(0,1fr)_1.75rem_minmax(0,1fr)] gap-y-2.5 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)]"
    >
      <svg
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        {connectors.map((connector) => {
          const isNewConnector = connector.key === newConnectorKey;
          const strokeDashoffset = isNewConnector && !isNewConnectorRevealed ? 1 : 0;
          return (
            <g key={connector.key} stroke={getMatchColor(connector.leftIndex, lefts.length)}>
              <path
                className="match-path match-path-halo"
                d={connector.path}
                fill="none"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                strokeWidth={8}
                vectorEffect="non-scaling-stroke"
              />
              <path
                className="match-path"
                d={connector.path}
                fill="none"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={strokeDashoffset}
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
          // The first row carries its pair colour from the start so the
          // click-then-click interaction reads before anything is selected.
          const isTinted =
            isActive || Boolean(match) || (!isReadOnly && activeLeft === null && index === 0);
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
                  className="match-press mr-1.5 grid w-8 shrink-0 place-items-center self-center rounded-lg text-current/60 opacity-0 transition-opacity duration-150 hover:bg-current/10 hover:text-current focus-visible:opacity-100 group-hover/endpoint:opacity-100 motion-reduce:transition-none"
                >
                  <X size={13} aria-hidden />
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

function MatchDot({ isTinted }: { isTinted: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2.5 shrink-0 rounded-full transition-colors duration-150",
        isTinted ? "bg-(--match-color)" : "bg-foreground/15",
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
export function createMatchPath(from: Point, to: Point) {
  const horizontalDistance = to.x - from.x;
  const verticalDistance = to.y - from.y;
  const controlOffset = clamp(
    Math.abs(horizontalDistance) * 0.55 + Math.abs(verticalDistance) * 0.12,
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
