import { createWildsRoamingCaptureHandler } from "@/lib/receiz/wilds-roaming-capture-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const POST = createWildsRoamingCaptureHandler();
