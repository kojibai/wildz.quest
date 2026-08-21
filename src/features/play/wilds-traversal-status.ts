import type { WildsAerialMode } from "./wilds-aerial-traversal";
import type { WildsAquaticPresentation } from "./wilds-aquatic-presentation";

export function projectWildsTraversalStatus(input: Readonly<{
  aerialMode: WildsAerialMode;
  aquaticMode: WildsAquaticPresentation["mode"];
  aquaticStatus: string | null;
  flightStatus: string | null;
}>) {
  if (input.aerialMode !== "ground") return input.flightStatus;
  if (input.aquaticMode === "swim" || input.aquaticMode === "wade" || input.aquaticMode === "blocked") {
    return input.aquaticStatus;
  }
  return input.flightStatus;
}
