import { useEffect, useRef, useCallback, useState } from "react";

interface PlinkoGameProps {
  ballCount: number;
  onResult: (slot: number, totalSlots: number, isBig: boolean) => void;
  onAllBallsDone: () => void;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
  done: boolean;
  color: string;
  trail: { x: number; y: number }[];
}

interface Peg {
  x: number;
  y: number;
}

const ROWS = 12;
const GRAVITY = 0.25;
const BOUNCE = 0.4;
const BALL_RADIUS = 7;
const PEG_RADIUS = 5;
const BALL_COLORS = ["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#f97316", "#ec4899"];

function buildPegs(width: number, height: number): Peg[] {
  const pegs: Peg[] = [];
  const topPad = 60;
  const bottomPad = 80;
  const usableH = height - topPad - bottomPad;
  const rowSpacing = usableH / (ROWS - 1);

  for (let row = 0; row < ROWS; row++) {
    const cols = row + 3;
    const rowWidth = (cols - 1) * 40;
    const startX = width / 2 - rowWidth / 2;
    const y = topPad + row * rowSpacing;
    for (let col = 0; col < cols; col++) {
      pegs.push({ x: startX + col * 40, y });
    }
  }
  return pegs;
}

export function getSlotCount(): number {
  return ROWS + 3;
}

export function slotMultiplier(slot: number, total: number): number {
  const mid = (total - 1) / 2;
  const dist = Math.abs(slot - mid) / mid;
  if (dist >= 0.9) return 100;
  if (dist >= 0.75) return 25;
  if (dist >= 0.55) return 5;
  if (dist >= 0.35) return 2;
  return 0;
}

export function isBigWin(slot: number, total: number): boolean {
  return slotMultiplier(slot, total) >= 25;
}

export default function PlinkoGame({ ballCount, onResult, onAllBallsDone }: PlinkoGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    balls: [] as Ball[],
    pegs: [] as Peg[],
    animId: 0,
    launched: 0,
    doneBalls: 0,
    ballCount: 0,
    reportedDone: false,
    running: false,
  });
  const [ballsLeft, setBallsLeft] = useState(ballCount);
  const [gameOver, setGameOver] = useState(false);

  const getCanvasSize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { w: 500, h: 560 };
    return { w: canvas.width, h: canvas.height };
  };

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { w, h } = getCanvasSize();
    const s = stateRef.current;
    const slotCount = getSlotCount();
    const slotW = w / slotCount;
    const bottomY = h - 60;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    // Slot dividers & labels
    for (let i = 0; i <= slotCount; i++) {
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(i * slotW, bottomY);
      ctx.lineTo(i * slotW, h);
      ctx.stroke();
    }

    for (let i = 0; i < slotCount; i++) {
      const mult = slotMultiplier(i, slotCount);
      const cx = i * slotW + slotW / 2;
      const big = mult >= 25;
      const med = mult >= 5 && mult < 25;

      if (big) {
        const grad = ctx.createLinearGradient(i * slotW, bottomY, i * slotW, h);
        grad.addColorStop(0, "rgba(234,179,8,0.3)");
        grad.addColorStop(1, "rgba(234,179,8,0.05)");
        ctx.fillStyle = grad;
      } else if (med) {
        ctx.fillStyle = "rgba(59,130,246,0.1)";
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.02)";
      }
      ctx.fillRect(i * slotW + 1, bottomY, slotW - 2, h - bottomY);

      ctx.font = `bold ${big ? 13 : 11}px monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = big ? "#fbbf24" : med ? "#60a5fa" : "#64748b";
      ctx.fillText(mult === 0 ? "0x" : `${mult}x`, cx, h - 10);
    }

    // Pegs
    for (const peg of s.pegs) {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, PEG_RADIUS, 0, Math.PI * 2);
      const pgrd = ctx.createRadialGradient(peg.x - 1, peg.y - 1, 0, peg.x, peg.y, PEG_RADIUS);
      pgrd.addColorStop(0, "#94a3b8");
      pgrd.addColorStop(1, "#334155");
      ctx.fillStyle = pgrd;
      ctx.fill();
    }

    // Update & draw balls
    let activeBalls = 0;
    for (const ball of s.balls) {
      if (!ball.active) continue;
      activeBalls++;

      ball.vy += GRAVITY;
      ball.x += ball.vx;
      ball.y += ball.vy;

      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 8) ball.trail.shift();

      for (const peg of s.pegs) {
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = ball.radius + PEG_RADIUS;
        if (dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx -= (1 + BOUNCE) * dot * nx + (Math.random() - 0.5) * 0.8;
          ball.vy -= (1 + BOUNCE) * dot * ny;
          ball.x = peg.x + nx * (minDist + 0.5);
          ball.y = peg.y + ny * (minDist + 0.5);
        }
      }

      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx) * BOUNCE;
      }
      if (ball.x + ball.radius > w) {
        ball.x = w - ball.radius;
        ball.vx = -Math.abs(ball.vx) * BOUNCE;
      }

      if (ball.y > bottomY && !ball.done) {
        ball.done = true;
        ball.active = false;
        const slot = Math.min(Math.floor(ball.x / slotW), slotCount - 1);
        s.doneBalls++;
        const big = isBigWin(slot, slotCount);
        onResult(slot, slotCount, big);

        if (s.doneBalls >= s.ballCount && !s.reportedDone) {
          s.reportedDone = true;
          s.running = false;
          setGameOver(true);
          onAllBallsDone();
        }
      }

      // Trail
      for (let t = 0; t < ball.trail.length; t++) {
        const alpha = (t / ball.trail.length) * 0.3;
        ctx.beginPath();
        ctx.arc(ball.trail[t].x, ball.trail[t].y, ball.radius * (t / ball.trail.length), 0, Math.PI * 2);
        ctx.fillStyle = ball.color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();
      }

      const bgrd = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, ball.radius);
      bgrd.addColorStop(0, "#ffffff");
      bgrd.addColorStop(0.3, ball.color);
      bgrd.addColorStop(1, ball.color + "aa");
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = bgrd;
      ctx.fill();
    }

    if (activeBalls > 0) {
      s.animId = requestAnimationFrame(drawFrame);
    } else {
      s.running = false;
    }
  }, [onResult, onAllBallsDone]);

  // Draw static board on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;
    s.pegs = buildPegs(canvas.width, canvas.height);
    s.balls = [];
    s.launched = 0;
    s.doneBalls = 0;
    s.ballCount = ballCount;
    s.reportedDone = false;
    s.running = false;
    setBallsLeft(ballCount);
    setGameOver(false);

    // Draw the empty board
    drawFrame();
    cancelAnimationFrame(s.animId);

    return () => cancelAnimationFrame(s.animId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ballCount]);

  const dropBall = useCallback(() => {
    const s = stateRef.current;
    if (s.launched >= s.ballCount || gameOver) return;

    const { w } = getCanvasSize();
    const color = BALL_COLORS[s.launched % BALL_COLORS.length];
    s.balls.push({
      x: w / 2 + (Math.random() - 0.5) * 4,
      y: 20,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1,
      radius: BALL_RADIUS,
      active: true,
      done: false,
      color,
      trail: [],
    });
    s.launched++;
    setBallsLeft(s.ballCount - s.launched);

    if (!s.running) {
      s.running = true;
      s.animId = requestAnimationFrame(drawFrame);
    }
  }, [drawFrame, gameOver]);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={500}
        height={560}
        className="rounded-xl border border-slate-700"
        style={{ imageRendering: "pixelated" }}
      />
      {!gameOver && (
        <button
          onClick={dropBall}
          disabled={ballsLeft <= 0}
          className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold text-sm transition-all active:scale-95 flex items-center gap-2"
        >
          Drop Ball
          <span className="px-2 py-0.5 rounded-full bg-slate-900/30 text-xs font-bold">
            {ballsLeft} left
          </span>
        </button>
      )}
    </div>
  );
}
