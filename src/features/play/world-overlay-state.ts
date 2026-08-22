import type { CreatureDrawerSnap } from "./creature-drawer";
import type { WildsCommandKey } from "./WildsCommandDock";

export type WorldOverlayOwner =
  | "none"
  | "map"
  | "trainer"
  | "combat"
  | "landmark"
  | "settlement"
  | "ecology"
  | "raid"
  | "reward"
  | "ceremony"
  | "memorial"
  | "profile"
  | "market"
  | "wallet"
  | "command"
  | "multiplayer";
export type WorldOverlayState = Readonly<{
  drawerSnap: CreatureDrawerSnap;
  toolsOpen: boolean;
  panelKey: WildsCommandKey | null;
  exclusiveOwner: WorldOverlayOwner;
}>;

export type WorldOverlayEvent =
  | { type: "drawer"; snap: CreatureDrawerSnap }
  | { type: "tools"; open: boolean }
  | { type: "panel"; key: WildsCommandKey | null }
  | { type: "exclusive"; owner: WorldOverlayOwner }
  | { type: "viewport-change" }
  | { type: "dismiss" };

export const initialWorldOverlayState: WorldOverlayState = Object.freeze({
  drawerSnap: "closed", toolsOpen: false, panelKey: null, exclusiveOwner: "none"
});

export function reduceWorldOverlay(state: WorldOverlayState, event: WorldOverlayEvent): WorldOverlayState {
  if (event.type === "dismiss" || event.type === "viewport-change") return initialWorldOverlayState;
  if (event.type === "exclusive") return { ...initialWorldOverlayState, exclusiveOwner: event.owner };
  if (state.exclusiveOwner !== "none") return state;
  if (event.type === "drawer") return { ...state, drawerSnap: event.snap, toolsOpen: false, panelKey: null };
  if (event.type === "tools") return { ...state, drawerSnap: "closed", toolsOpen: event.open, panelKey: null };
  return { ...state, drawerSnap: "closed", toolsOpen: false, panelKey: event.key };
}
