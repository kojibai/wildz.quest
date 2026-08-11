"use client";

import type { CSSProperties } from "react";
import { Navigation2 } from "lucide-react";
import { WILDS_FLAGSHIP_LANDMARKS } from "./wilds-landmarks";
import { projectWorldHeadingCompass } from "./world-heading-compass";

const positionStyle = (offsetDegrees: number) => ({
  "--wildz-compass-position": `${50 + offsetDegrees / 1.2}%`
} as CSSProperties);

export function WildzDirectionCompass({ heading, x, z }: { heading: number; x: number; z: number }) {
  const compass = projectWorldHeadingCompass({ heading, x, z, landmarks: WILDS_FLAGSHIP_LANDMARKS });
  return <div className="wildz-direction-compass" role="status" aria-label={`Facing ${compass.cardinal}, ${Math.round(compass.degrees)} degrees`}>
    <div aria-hidden="true" className="wildz-direction-compass-track">
      {compass.ticks.map((tick) => <span className={`wildz-direction-compass-tick${tick.degrees % 45 === 0 ? " is-cardinal" : ""}`} key={tick.degrees} style={positionStyle(tick.offsetDegrees)}>{tick.label}</span>)}
      {compass.landmarks.map((landmark) => <span className="wildz-direction-compass-landmark" key={landmark.id} style={positionStyle(landmark.offsetDegrees)} title={`${landmark.name} · ${Math.round(landmark.distance)}m`}><i />{landmark.name}</span>)}
    </div>
    <Navigation2 aria-hidden="true" className="wildz-direction-compass-caret" size={12} strokeWidth={3} />
  </div>;
}
