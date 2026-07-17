"use client";

import { useEffect, useRef } from "react";
import { WILDS_MAJOR_ROUTES } from "./wilds-world-geography";
import { WILDS_FLAGSHIP_LANDMARKS } from "./wilds-landmarks";

const VIEW_RADIUS = 22;

function mapPoint(worldX: number, worldZ: number, playerX: number, playerZ: number, size: number) {
  return {
    x: size / 2 + (worldX - playerX) / VIEW_RADIUS * size / 2,
    y: size / 2 + (worldZ - playerZ) / VIEW_RADIUS * size / 2
  };
}

export function WildzMinimap({ x, z, heading = 0, onOpen }: { x: number; z: number; heading?: number; onOpen: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const size = 180;
    canvas.width = size;
    canvas.height = size;
    context.clearRect(0, 0, size, size);
    const ground = context.createRadialGradient(size * .48, size * .42, 8, size / 2, size / 2, size * .7);
    ground.addColorStop(0, "#8bb66b");
    ground.addColorStop(1, "#557d48");
    context.fillStyle = ground;
    context.fillRect(0, 0, size, size);
    context.save();
    context.beginPath();
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    context.clip();
    context.lineCap = "round";
    for (const route of WILDS_MAJOR_ROUTES) {
      context.strokeStyle = "#9c8656";
      context.lineWidth = route.id === "golden-spine" ? 11 : 8;
      context.beginPath();
      route.points.forEach((point, index) => {
        const projected = mapPoint(point.x, point.z, x, z, size);
        if (index === 0) context.moveTo(projected.x, projected.y);
        else context.lineTo(projected.x, projected.y);
      });
      context.stroke();
      context.strokeStyle = "#dbc58d";
      context.lineWidth -= 4;
      context.stroke();
    }
    for (let tileZ = Math.floor((z - VIEW_RADIUS) / 12); tileZ <= Math.ceil((z + VIEW_RADIUS) / 12); tileZ += 1) {
      for (let tileX = Math.floor((x - VIEW_RADIUS) / 12); tileX <= Math.ceil((x + VIEW_RADIUS) / 12); tileX += 1) {
        const seed = Math.sin((tileX * 73856093 ^ tileZ * 19349663) * .00001) * 43758.5453;
        const unit = seed - Math.floor(seed);
        const projected = mapPoint(tileX * 12 + 2 + unit * 8, tileZ * 12 + 2 + ((unit * 7) % 1) * 8, x, z, size);
        context.fillStyle = unit > .7 ? "#2f6540" : "#437b49";
        context.beginPath();
        context.arc(projected.x, projected.y, 4 + unit * 5, 0, Math.PI * 2);
        context.fill();
      }
    }
    for (const landmark of WILDS_FLAGSHIP_LANDMARKS) {
      const projected = mapPoint(landmark.position.x, landmark.position.z, x, z, size);
      if (projected.x < -8 || projected.x > size + 8 || projected.y < -8 || projected.y > size + 8) continue;
      context.fillStyle = landmark.accent;
      context.beginPath(); context.arc(projected.x, projected.y, 4, 0, Math.PI * 2); context.fill();
      context.strokeStyle = "rgba(255,255,255,.84)"; context.lineWidth = 1.5; context.stroke();
    }
    context.restore();
  }, [x, z]);
  return <button className="wildz-minimap" aria-label={`Open world map. Current position X ${Math.round(x)}, Z ${Math.round(z)}`} onClick={onOpen} type="button">
    <canvas ref={canvasRef} />
    <span aria-hidden="true" className="wildz-minimap-heading" style={{ transform: `translate(-50%, -50%) rotate(${heading}rad)` }}>▲</span>
    <b>X {Math.round(x)} · Z {Math.round(z)}</b>
  </button>;
}
