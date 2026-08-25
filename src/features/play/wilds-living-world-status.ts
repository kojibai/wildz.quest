import type { WildsWorldClientMode } from "./use-wilds-world";

export function wildsLivingWorldModeLabel(mode: WildsWorldClientMode, sharedConnectionLive = false) {
  return sharedConnectionLive || mode === "receiz_live" || mode === "kai_live"
    ? "Connected"
    : "World reconnecting";
}
