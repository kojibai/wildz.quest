export type WildzOverlay =
  | { kind: "profile"; username: string }
  | { kind: "card"; assetId: string }
  | { kind: "vault" }
  | { kind: "market" }
  | { kind: "map" }
  | { kind: "settings" }
  | null;
