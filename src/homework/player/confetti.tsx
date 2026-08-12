import { useEffect, useRef } from "react";

/**
 * A short burst on the canvas, for the one moment in the homework worth
 * celebrating. Hand-rolled because a confetti dependency would be larger than
 * the whole player, and drawn on a canvas so it never touches layout.
 */
const PIECE_COUNT = 90;
const GRAVITY = 0.12;
const DRAG = 0.985;
const FADE_START_MILLISECONDS = 1_400;
const DURATION_MILLISECONDS = 2_600;
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

function createPieces(width: number) {
  return Array.from({ length: PIECE_COUNT }, (): Piece => {
    // Two jets from the lower corners, the way a party popper actually throws.
    const isLeftJet = Math.random() < 0.5;
    const angle = (isLeftJet ? -55 : -125) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
    const speed = 9 + Math.random() * 7;
    return {
      x: isLeftJet ? width * 0.15 : width * 0.85,
      y: 1,
      velocityX: Math.cos(angle) * speed * (isLeftJet ? 1 : -1),
      velocityY: Math.sin(angle) * speed,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      width: 6 + Math.random() * 5,
      height: 3 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0]!,
    };
  });
}

export function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(function runBurst() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = canvas.getContext("2d");
    const parent = canvas.parentElement;
    if (!context || !parent) return;

    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const { width, height } = parent.getBoundingClientRect();
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    context.scale(pixelRatio, pixelRatio);

    // Pieces launch from the bottom, so the origin is flipped once here rather
    // than in every frame.
    const pieces = createPieces(width).map((piece) => ({ ...piece, y: height }));
    const startedAt = performance.now();
    let frame = 0;

    function draw(now: number) {
      const elapsed = now - startedAt;
      context!.clearRect(0, 0, width, height);
      context!.globalAlpha =
        elapsed < FADE_START_MILLISECONDS
          ? 1
          : Math.max(
              0,
              1 - (elapsed - FADE_START_MILLISECONDS) /
                (DURATION_MILLISECONDS - FADE_START_MILLISECONDS),
            );

      for (const piece of pieces) {
        piece.velocityX *= DRAG;
        piece.velocityY = piece.velocityY * DRAG + GRAVITY * 6;
        piece.x += piece.velocityX;
        piece.y += piece.velocityY;
        piece.rotation += piece.spin;

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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full"
    />
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
