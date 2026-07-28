// Compatibility alias only. Current Receiz proof creation is the authenticated
// native Record -> Seal flow exposed by the canonical proof-object endpoint.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export { POST } from "../proof-object/route";
