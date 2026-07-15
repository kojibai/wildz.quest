"use client";

import { useEffect, useRef } from "react";

export function WildzMinimap({ x, z, heading = 0 }: { x: number; z: number; heading?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const size = 180;
    canvas.width = size;
    canvas.height = size;
    context.clearRect(0, 0, size, size);
    context.fillStyle = "#6f9d58";
    context.fillRect(0, 0, size, size);
    context.lineCap = "round";
    context.strokeStyle = "#d8c184";
    context.lineWidth = 18;
    context.beginPath();
    context.moveTo(38, 0);
    context.bezierCurveTo(52, 50, 124, 42, 98, 92);
    context.bezierCurveTo(76, 128, 128, 145, 142, 180);
    context.stroke();
    context.fillStyle = "#3d7144";
    for (const [px, py, radius] of [[25, 33, 17], [146, 28, 21], [30, 132, 23], [145, 120, 18], [80, 24, 12]] as const) {
      context.beginPath(); context.arc(px, py, radius, 0, Math.PI * 2); context.fill();
    }
    context.fillStyle = "#62a8ff";
    for (const [px, py] of [[52, 74], [139, 76], [59, 145], [118, 130]] as const) {
      context.beginPath(); context.arc(px, py, 4.2, 0, Math.PI * 2); context.fill();
    }
  }, [x, z]);
  return <div className="wildz-minimap" aria-label={`World minimap. X ${Math.round(x)}, Z ${Math.round(z)}`}>
    <canvas ref={canvasRef} />
    <span className="wildz-minimap-heading" style={{ transform: `translate(-50%, -50%) rotate(${heading}rad)` }}>▲</span>
    <b>X {Math.round(x)} · Z {Math.round(z)}</b>
  </div>;
}
