export type WildzOverlay =
  | { kind: "profile"; username: string; mode?: "owner" | "public" }
  | { kind: "card"; assetId: string }
  | { kind: "vault" }
  | { kind: "market" }
  | { kind: "map" }
  | { kind: "settings" }
  | null;
