// Bottom-right minimap: draws the player and nearby others as dots
// on a small canvas, scaled from world coordinates to minimap pixels.
// Pure rendering component driven by MinimapData passed from GameCanvas.
// Redraws on every data update via a canvas 2D context.
"use client";

import { useEffect, useRef } from "react";
import { WORLD } from "@blobwars/shared";

export interface MinimapData {
  self: { x: number; y: number };
  others: { x: number; y: number; color: number }[];
  crates: { x: number; y: number }[];
}

export function Minimap({ data, raised }: { data: MinimapData | null; raised?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SIZE = 150;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "rgba(20, 24, 36, 0.85)";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.strokeRect(0, 0, SIZE, SIZE);

    const toMap = (x: number, y: number) => ({
      mx: (x / WORLD.WIDTH) * SIZE,
      my: (y / WORLD.HEIGHT) * SIZE,
    });

    // Supply crates — green dots with a soft glow so they stand out from
    // player dots even at the minimap's small size.
    for (const c of data.crates ?? []) {
      const { mx, my } = toMap(c.x, c.y);
      ctx.fillStyle = "rgba(46, 204, 113, 0.35)";
      ctx.beginPath();
      ctx.arc(mx, my, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2ecc71";
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const o of data.others) {
      const { mx, my } = toMap(o.x, o.y);
      ctx.fillStyle = `#${o.color.toString(16).padStart(6, "0")}`;
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const { mx, my } = toMap(data.self.x, data.self.y);
    ctx.fillStyle = "#4f9dff";
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className={`absolute z-0 right-2 sm:right-4 safe-right w-[100px] h-[100px] sm:w-[150px] sm:h-[150px] rounded-lg border border-white/10 pointer-events-none transition-[bottom] duration-150 ${
        raised ? "bottom-36 sm:bottom-48" : "bottom-24 sm:bottom-32"
      }`}
    />
  );
}
