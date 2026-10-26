import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Point = readonly [x: number, y: number];

type TraceShape = {
  name: string;
  hint: string;
  build: (samples: number) => Point[];
};

const SHAPES: readonly TraceShape[] = [
  {
    name: "Spiral",
    hint: "Start in the middle and glide outwards.",
    build: (n) => {
      const turns = 2.5 * Math.PI;
      return Array.from({ length: n }, (_, i) => {
        const t = (i / (n - 1)) * turns;
        const r = 0.05 + 0.38 * (t / turns);
        return [0.5 + r * Math.cos(t), 0.5 + r * Math.sin(t)] as const;
      });
    },
  },
  {
    name: "Heart",
    hint: "Trace the top dip first, then around.",
    build: (n) =>
      Array.from({ length: n }, (_, i) => {
        const t = (i / (n - 1)) * 2 * Math.PI;
        const x = 16 * Math.sin(t) ** 3;
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        return [0.5 + (x / 17) * 0.4, 0.45 - (y / 17) * 0.4] as const;
      }),
  },
  {
    name: "Star",
    hint: "Zig from tip to tip, nice and slow.",
    build: (n) => {
      const corners: Point[] = [];
      const spikes = 5;
      for (let i = 0; i < spikes * 2; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / spikes;
        const r = i % 2 === 0 ? 0.42 : 0.18;
        corners.push([0.5 + r * Math.cos(angle), 0.5 + r * Math.sin(angle)]);
      }
      corners.push(corners[0]);
      const perEdge = Math.max(2, Math.floor(n / corners.length));
      const pts: Point[] = [];
      for (let i = 0; i < corners.length - 1; i++) {
        const [ax, ay] = corners[i];
        const [bx, by] = corners[i + 1];
        for (let s = 0; s < perEdge; s++) {
          const f = s / perEdge;
          pts.push([ax + (bx - ax) * f, ay + (by - ay) * f]);
        }
      }
      return pts;
    },
  },
  {
    name: "Wave",
    hint: "Ride the waves from left to right.",
    build: (n) =>
      Array.from({ length: n }, (_, i) => {
        const x = 0.08 + (0.84 * i) / (n - 1);
        const y = 0.5 + 0.26 * Math.sin(((x - 0.08) / 0.84) * Math.PI * 3);
        return [x, y] as const;
      }),
  },
];

const LOOKAHEAD = 30;
const TOUCH_RADIUS = 0.085;

/**
 * The signature Glow Trace activity: follow the glowing light along a shape
 * with a finger or stylus. Pointer-based, so touch and mouse both work.
 */
export const GlowTraceCanvas = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracedRef = useRef(0);
  const completeRef = useRef(false);
  const [shapeIndex, setShapeIndex] = useState(0);
  const [size, setSize] = useState(0);
  const [progress, setProgress] = useState(0);

  const shape = SHAPES[shapeIndex] as TraceShape;
  const points = useMemo(() => shape.build(220), [shape]);
  const pointsRef = useRef(points);
  pointsRef.current = points;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || size < 40) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue("--primary").trim() || "oklch(0.84 0.13 190)";
    const amber = styles.getPropertyValue("--glow").trim() || "oklch(0.86 0.13 85)";
    const pts = pointsRef.current;
    const traced = tracedRef.current;
    const lineWidth = size * 0.035;

    // Faint guide path to follow.
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = primary;
    ctx.lineWidth = lineWidth * 0.8;
    ctx.setLineDash([size * 0.02, size * 0.03]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      if (i === 0) ctx.moveTo(x * size, y * size);
      else ctx.lineTo(x * size, y * size);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Glowing progress laid over the guide.
    ctx.globalAlpha = 1;
    ctx.strokeStyle = completeRef.current ? amber : primary;
    ctx.shadowColor = completeRef.current ? amber : primary;
    ctx.shadowBlur = size * 0.06;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let i = 0; i <= traced && i < pts.length; i++) {
      const [x, y] = pts[i];
      if (i === 0) ctx.moveTo(x * size, y * size);
      else ctx.lineTo(x * size, y * size);
    }
    ctx.stroke();

    // Starting dot pulses so the child knows where to begin.
    const [sx, sy] = pts[0];
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = primary;
    ctx.shadowBlur = size * 0.08;
    ctx.beginPath();
    ctx.arc(sx * size, sy * size, lineWidth * 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle rides the finger while tracing.
    if (!completeRef.current && traced > 0) {
      const [cx, cy] = pts[Math.min(traced, pts.length - 1)];
      ctx.fillStyle = amber;
      ctx.beginPath();
      ctx.arc(cx * size, cy * size, lineWidth * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }, [size]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setSize(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    draw();
  }, [draw, points, progress, shapeIndex]);

  const handlePointer = useCallback((event: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || completeRef.current) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const pts = pointsRef.current;
    let traced = tracedRef.current;
    let bestIdx = -1;
    let bestDist = TOUCH_RADIUS;
    const limit = Math.min(pts.length, traced + LOOKAHEAD);
    for (let i = traced; i < limit; i++) {
      const dist = Math.hypot(pts[i][0] - x, pts[i][1] - y);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx > traced) {
      tracedRef.current = bestIdx;
      const next = bestIdx / (pts.length - 1);
      setProgress(next);
      if (next >= 0.985) {
        completeRef.current = true;
        setProgress(1);
        toast.success("You traced the whole shape. Beautiful focus!", {
          description: "Tap a new shape to keep glowing.",
        });
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("pointerdown", handlePointer);
    canvas.addEventListener("pointermove", handlePointer);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointer);
      canvas.removeEventListener("pointermove", handlePointer);
    };
  }, [handlePointer]);

  const chooseShape = (index: number) => {
    tracedRef.current = 0;
    completeRef.current = false;
    setProgress(0);
    setShapeIndex(index % SHAPES.length);
  };

  const percent = Math.round(progress * 100);

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative mx-auto aspect-square w-full max-w-sm touch-none rounded-3xl border border-border bg-card/60 p-2"
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-pointer rounded-2xl"
          style={{ width: "100%", height: "100%" }}
          role="img"
          aria-label={`Trace the ${shape.name}. Progress: ${percent} percent.`}
        />
        {progress === 0 && (
          <p className="pointer-events-none absolute inset-x-4 bottom-4 text-center text-sm text-muted-foreground">
            Start at the glowing dot and follow the light.
          </p>
        )}
        {progress === 1 && (
          <p className="pointer-events-none absolute inset-x-4 bottom-4 text-center text-base font-semibold text-glow">
            Complete — beautifully traced!
          </p>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {shape.name} tracing progress: {percent} percent.
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {SHAPES.map((option, index) => (
          <button
            key={option.name}
            type="button"
            onClick={() => chooseShape(index)}
            aria-pressed={index === shapeIndex}
            className={`inline-flex min-h-[50px] items-center justify-center rounded-full border px-5 text-base font-semibold transition-colors ${
              index === shapeIndex
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-secondary/60 text-secondary-foreground hover:bg-secondary"
            }`}
          >
            {option.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-sm text-muted-foreground">{shape.hint}</p>
    </div>
  );
};
