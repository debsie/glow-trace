import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/hooks/use-in-view";

import type { SceneKind } from "./scenes";

/** Theme tokens a scene can draw in. Read from CSS at runtime, so both themes just work. */
type Token = "primary" | "primary-foreground" | "muted-foreground" | "foreground" | "accent";

/** Resolve a CSS colour token (oklch) to sRGB bytes by letting the browser paint one pixel. */
const readToken = (token: Token): [number, number, number] => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [128, 128, 128];
  context.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
  context.fillRect(0, 0, 1, 1);
  const [r = 128, g = 128, b = 128] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
};

/**
 * A decorative WebGL canvas. three.js loads on demand in the browser only; the scene pauses
 * when off-screen or in a hidden tab, renders a single still frame under reduced motion, and
 * silently renders nothing where WebGL is unavailable.
 */
export const ThreeCanvas = ({
  scene: kind,
  base,
  accent,
  className = "",
}: {
  scene: SceneKind;
  base: Token;
  accent: Token;
  className?: string;
}) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const [THREE, { createScene }] = await Promise.all([import("three"), import("./scenes")]);
      if (cancelled) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        return; // No WebGL: the page reads fine without the decoration.
      }
      const canvas = renderer.domElement;
      canvas.className = "block h-full w-full";
      host.appendChild(canvas);

      const colors = () => {
        const toColor = (token: Token) => {
          const [r, g, b] = readToken(token);
          return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
        };
        return { base: toColor(base), accent: toColor(accent) };
      };
      const handle = createScene(kind, colors());

      const pointer = { x: 0, y: 0 };
      const eased = { x: 0, y: 0 };
      const still = prefersReducedMotion();
      let visible = false;
      let frame = 0;
      const started = performance.now();

      const render = () => {
        eased.x += (pointer.x - eased.x) * 0.05;
        eased.y += (pointer.y - eased.y) * 0.05;
        handle.update(still ? 2.4 : (performance.now() - started) / 1000, eased);
        renderer.render(handle.scene, handle.camera);
      };
      const loop = () => {
        render();
        frame = requestAnimationFrame(loop);
      };
      const sync = () => {
        cancelAnimationFrame(frame);
        if (still) render();
        else if (visible && !document.hidden) loop();
      };

      const resize = () => {
        const { clientWidth, clientHeight } = host;
        const pixelRatio = Math.min(window.devicePixelRatio, 2);
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(clientWidth, clientHeight, false);
        handle.resize(clientWidth, clientHeight, pixelRatio);
        if (still || !visible) render();
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);

      const viewObserver = new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        sync();
      });
      viewObserver.observe(host);

      const onPointer = (event: PointerEvent) => {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
      };
      const scheme = window.matchMedia("(prefers-color-scheme: dark)");
      const onScheme = () => {
        handle.setColors(colors());
        if (still) render();
      };
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.addEventListener("visibilitychange", sync);
      scheme.addEventListener("change", onScheme);

      cleanup = () => {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        viewObserver.disconnect();
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", sync);
        scheme.removeEventListener("change", onScheme);
        handle.dispose();
        renderer.dispose();
        canvas.remove();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [kind, base, accent]);

  return <div ref={hostRef} aria-hidden="true" className={`pointer-events-none ${className}`} />;
};
