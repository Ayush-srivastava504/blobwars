"use client";

import { useEffect, useRef } from "react";
import { WORLD } from "@blobwars/shared";

export interface MinimapData {
  self: { x: number; y: number };
  others: { x: number; y: number; color: number }[];
}

export function Minimap({ data }: { data: MinimapData | null }) {
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
      className="absolute bottom-4 right-4 rounded-lg border border-white/10 pointer-events-none"
    />
  );
}
