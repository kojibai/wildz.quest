import type { WildsWorldClientMode } from "./use-wilds-world";

export function wildsLivingWorldModeLabel(mode: WildsWorldClientMode, proofSessionConnected = false) {
  void proofSessionConnected;
  return mode === "receiz_live" ? "Connected" : mode === "local_practice" ? "Local practice" : "World reconnecting";
}
