"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Icons } from "@/components/icons";
import { cx } from "@/lib/utils";
import type { GameAction, WildsInput } from "./game-state";
import type { WildsContextAction } from "./wilds-context-action";
import { cameraRelativeMovement, type WildsMovementMode } from "./wilds-movement";

export function WildsWorldControls({
  cameraHeading,
  movementMode,
  pulse,
  activeAction,
  activeCardName,
  onInput,
  onMovementModeChange,
  onPulse,
  onRest,
  onTrain,
  onMission
}: {
  cameraHeading: number;
  movementMode: WildsMovementMode;
  pulse: WildsContextAction;
  activeAction: GameAction;
  activeCardName: string;
  onInput: (input: WildsInput) => void;
  onMovementModeChange: (mode: WildsMovementMode) => void;
  onPulse: () => void;
  onRest: () => void;
  onTrain: () => void;
  onMission: () => void;
}) {
  return (
    <div className="wilds-screen-controls" aria-label="World controls">
      <div className="wilds-control-rail wilds-control-rail-left" aria-label="Explore actions">
        <button
          aria-label="Discovery on. Tap terrain to search for a hidden creature"
          aria-pressed="true"
          className="wilds-action active ready"
          title="Discovery is always on"
          type="button"
        >
          <Icons.game size={20} />
        </button>
        <button className="wilds-action" onClick={onRest} aria-label="Make camp and recover energy" title="Camp: recover energy" type="button">
          <Icons.home size={20} />
        </button>
        <button
          aria-label={movementMode === "walk" ? "Switch to running" : "Switch to walking"}
          aria-pressed={movementMode === "run"}
          className={cx("wilds-action wilds-movement-mode", movementMode === "run" && "active")}
          onClick={() => onMovementModeChange(movementMode === "walk" ? "run" : "walk")}
          title={movementMode === "walk" ? "Walking · switch to run" : "Running · switch to walk"}
          type="button"
        >
          {movementMode === "walk" ? <Icons.walk aria-hidden="true" size={22} /> : <Icons.run aria-hidden="true" size={22} />}
        </button>
      </div>

      <WildsTrackpad cameraHeading={cameraHeading} movementMode={movementMode} onInput={onInput} />

      <div className="wilds-control-rail wilds-control-rail-right" aria-label="Progression actions">
        <button
          aria-label={pulse.label}
          className={`wilds-action wilds-pulse-action pulse-${pulse.kind}`}
          onClick={onPulse}
          title={pulse.label}
          type="button"
        >
          <Icons.pulse aria-hidden="true" size={23} />
        </button>
        <button
          className={cx("wilds-action", activeAction === "train" && "active")}
          onClick={onTrain}
          aria-label={`Train ${activeCardName}`}
          title={`Train ${activeCardName}`}
          type="button"
        >
          <Icons.sparkle size={20} />
        </button>
        <button
          className={cx("wilds-action", activeAction === "mission" && "active")}
          onClick={onMission}
          aria-label="Run world mission"
          title="Run world mission"
          type="button"
        >
          <Icons.trophy size={20} />
        </button>
      </div>
    </div>
  );
}

function WildsTrackpad({
  cameraHeading,
  movementMode,
  onInput
}: {
  cameraHeading: number;
  movementMode: WildsMovementMode;
  onInput: (input: WildsInput) => void;
}) {
  const vectorRef = useRef({ x: 0, z: 0 });
  const [active, setActive] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      const vector = vectorRef.current;
      if (Math.hypot(vector.x, vector.z) >= 0.08) {
        const relative = cameraRelativeMovement(vector, cameraHeading);
        onInput({ type: "move-vector", x: relative.x, z: relative.z, mode: movementMode });
      }
    }, 45);
    return () => window.clearInterval(timer);
  }, [active, cameraHeading, movementMode, onInput]);

  const updateVector = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.42);
    const rawX = event.clientX - (rect.left + rect.width / 2);
    const rawY = event.clientY - (rect.top + rect.height / 2);
    const magnitude = Math.hypot(rawX, rawY);
    const clampScale = magnitude > radius ? radius / magnitude : 1;
    const x = rawX * clampScale;
    const y = rawY * clampScale;
    vectorRef.current = { x: x / radius, z: y / radius };
    setKnob({ x, y });
  };

  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; releasing still stops movement.
    }
    vectorRef.current = { x: 0, z: 0 };
    setKnob({ x: 0, y: 0 });
    setActive(false);
  };

  return (
    <button
      aria-label={`Movement trackpad. ${movementMode === "run" ? "Running" : "Walking"}. Hold and drag in any direction to travel.`}
      className={cx("wilds-trackpad", active && "active")}
      onPointerCancel={release}
      onPointerDown={(event) => {
        updateVector(event);
        setActive(true);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Some embedded browsers do not expose pointer capture.
        }
      }}
      onPointerMove={(event) => {
        let captured = false;
        try {
          captured = event.currentTarget.hasPointerCapture(event.pointerId);
        } catch {
          captured = false;
        }
        if (active || captured) updateVector(event);
      }}
      onPointerUp={release}
      title={`${movementMode === "run" ? "Run" : "Walk"} · hold and drag to move`}
      type="button"
    >
      <span className="wilds-trackpad-ring" />
      <span className="wilds-trackpad-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </button>
  );
}
