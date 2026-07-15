import { createReceizClient } from "@receiz/sdk";

export type ReceizSdkCapabilities = {
  twin: boolean;
  world: boolean;
};

function sdkNamespaceReady(namespace: "twin" | "world") {
  try {
    const client = createReceizClient() as unknown as Record<string, unknown>;
    return Boolean(client[namespace]);
  } catch {
    return false;
  }
}

export const receizSdkCapabilities: ReceizSdkCapabilities = {
  twin: process.env.NEXT_PUBLIC_RECEIZ_TWIN_ENABLED !== "false" && sdkNamespaceReady("twin"),
  world: process.env.NEXT_PUBLIC_RECEIZ_WORLD_ENABLED !== "false" && sdkNamespaceReady("world")
};

export function hasReceizTwinCapability() {
  return receizSdkCapabilities.twin || receizSdkCapabilities.world;
}
