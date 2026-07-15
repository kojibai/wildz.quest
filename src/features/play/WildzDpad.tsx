"use client";

import { Icons } from "@/components/icons";
import type { MoveDirection } from "./game-state";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export function WildzDpad({ onMove }: { onMove: (direction: MoveDirection) => void }) {
  const timer = useRef<number | null>(null);
  const [active, setActive] = useState<MoveDirection | null>(null);

  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setActive(null);
  };

  useEffect(() => stop, []);

  const start = (direction: MoveDirection, event: ReactPointerEvent<HTMLButtonElement>) => {
    stop();
    setActive(direction);
    onMove(direction);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is optional */ }
    timer.current = window.setInterval(() => onMove(direction), 90);
  };

  const directions = [
    { direction: "north" as const, label: "Move north", Icon: Icons.chevronUp },
    { direction: "east" as const, label: "Move east", Icon: Icons.chevronRight },
    { direction: "south" as const, label: "Move south", Icon: Icons.chevronDown },
    { direction: "west" as const, label: "Move west", Icon: Icons.chevronLeft }
  ];

  return <div className="wildz-dpad" aria-label="Explorer movement controls">
    <span className="wildz-dpad-ring" aria-hidden="true" />
    {directions.map(({ direction, label, Icon }) => <button
      aria-label={label}
      aria-pressed={active === direction}
      className={`wildz-dpad-${direction}`}
      key={direction}
      onLostPointerCapture={stop}
      onPointerCancel={stop}
      onPointerDown={(event) => start(direction, event)}
      onPointerUp={stop}
      type="button"
    ><Icon aria-hidden="true" size={25} /></button>)}
    <i className="wildz-dpad-knob" aria-hidden="true" />
  </div>;
}
