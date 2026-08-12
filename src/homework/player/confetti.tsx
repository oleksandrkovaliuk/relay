import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A short burst on the canvas, for the one moment in the homework worth
 * celebrating. Hand-rolled because a confetti dependency would be larger than
 * the whole player, and drawn on a canvas so it never touches layout.
 */
const PIECE_COUNT = 180;
const FADE_START_MILLISECONDS = 1_900;
const DURATION_MILLISECONDS = 3_200;
/**
 * Physics in pixels per second, not per frame: a per-frame burst runs twice as
 * fast on a 120Hz display as on a 60Hz one. Speed and gravity are scaled to the
 * screen so the arc peaks near the top whatever the size, and the horizontal
 * drag is what makes the spread fan out and hang.
 */
const LAUNCH_SPEED_FACTOR = 1.15;
const GRAVITY_FACTOR = 1.35;
const DRAG_PER_SECOND = 0.55;
/** A long frame — a tab regaining focus — must not teleport the pieces. */
const MAXIMUM_STEP_SECONDS = 1 / 30;
/** Relay green first, then the same spread of hues the homework badges use. */
const COLORS = ["#007A56", "#10B981", "#C08A12", "#A63B33", "#4F7BD8", "#8B5CF6"];

type Piece = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  spin: number;
  width: number;
  height: number;
  color: string;
};

function createPieces(width: number, height: number) {
  const diagonal = Math.hypot(width, height);
  return Array.from({ length: PIECE_COUNT }, (): Piece => {
    // Two jets from the actual bottom corners of the screen, aimed inwards and
    // up, so the spread meets in the middle and covers the whole viewport.
    const isLeftJet = Math.random() < 0.5;
    const spread = (Math.random() - 0.5) * 0.85;
    const angle = (isLeftJet ? -Math.PI / 3.1 : -Math.PI + Math.PI / 3.1) + spread;
    const speed = diagonal * LAUNCH_SPEED_FACTOR * (0.72 + Math.random() * 0.62);
    return {
      x: isLeftJet ? -8 : width + 8,
      y: height + 8,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.34,
      width: 7 + Math.random() * 7,
      height: 4 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0]!,
    };
  });
}

export function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(function attachToBody() {
    // Rendered into the body, not the card: an ancestor with a transform — the
    // result panel animates one on arrival — would turn `fixed` into `absolute`
    // and trap the burst inside a box again.
    setPortalTarget(document.body);
  }, []);

  useEffect(function runBurst() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    context.scale(pixelRatio, pixelRatio);

    const gravity = height * GRAVITY_FACTOR;
    const pieces = createPieces(width, height);
    const startedAt = performance.now();
    let lastFrameAt = startedAt;
    let frame = 0;

    function draw(now: number) {
      const elapsed = now - startedAt;
      const step = Math.min(MAXIMUM_STEP_SECONDS, (now - lastFrameAt) / 1_000);
      lastFrameAt = now;
      context!.clearRect(0, 0, width, height);
      context!.globalAlpha =
        elapsed < FADE_START_MILLISECONDS
          ? 1
          : Math.max(
              0,
              1 -
                (elapsed - FADE_START_MILLISECONDS) /
                  (DURATION_MILLISECONDS - FADE_START_MILLISECONDS),
            );

      const drag = Math.pow(DRAG_PER_SECOND, step);
      for (const piece of pieces) {
        piece.velocityX *= drag;
        piece.velocityY = piece.velocityY * drag + gravity * step;
        piece.x += piece.velocityX * step;
        piece.y += piece.velocityY * step;
        piece.rotation += piece.spin * step * 60;

        context!.save();
        context!.translate(piece.x, piece.y);
        context!.rotate(piece.rotation);
        context!.fillStyle = piece.color;
        context!.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
        context!.restore();
      }

      if (elapsed < DURATION_MILLISECONDS) frame = window.requestAnimationFrame(draw);
    }

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [portalTarget]);

  if (!portalTarget) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 h-screen w-screen"
    />,
    portalTarget,
  );
}

const CELEBRATION_EMOJI = [
  "🎉",
  "🥳",
  "🙌",
  "✨",
  "🚀",
  "🌟",
  "💪",
  "🧠",
  "🔥",
  "🏆",
  "😎",
  "📚",
] as const;

/** One at random per submission — the same screen twice should not feel identical. */
export function pickCelebrationEmoji() {
  return (
    CELEBRATION_EMOJI[Math.floor(Math.random() * CELEBRATION_EMOJI.length)] ??
    CELEBRATION_EMOJI[0]
  );
}
