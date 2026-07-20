import type { WildsWorldClientMode } from "./use-wilds-world";

export function wildsLivingWorldModeLabel(mode: WildsWorldClientMode, proofSessionConnected = false) {
  void proofSessionConnected;
  return mode === "receiz_live" || mode === "kai_live"
    ? "Connected"
    : mode === "receiz_recovery_pending"
      ? "Live sync pending"
      : "World reconnecting";
}
