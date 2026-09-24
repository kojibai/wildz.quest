import { createReceizOfflineSealer } from "@receiz/sdk/offline";
import { createWildzBrowserSealStore } from "./store";

let runtime: Promise<ReturnType<typeof createReceizOfflineSealer>> | undefined;
function prepare() {
  return runtime ??= (async () => {
    const load = async (path: string) => {
      const response = await fetch(path, { credentials: "omit" });
      if (!response.ok) throw new Error("wildz_offline_seal_resources_unavailable");
      return new Uint8Array(await response.arrayBuffer());
    };
    const [wasm, zkey] = await Promise.all([load("/zk/document_seal_proof_js/sigil_proof.wasm"), load("/zk/document_seal_proof_final.zkey")]);
    const resources = { wasm, zkey };
    return createReceizOfflineSealer({ resources, store: await createWildzBrowserSealStore(resources),
      enrollmentUrl: "/api/receiz/local-signer/enroll" });
  })().catch(error => { runtime = undefined; throw error; });
}
// Serialize enrollment and proving to bound memory and prevent duplicate custody.
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<{ id: number; command: "ready" | "enroll" | "seal"; input?: { bytes: Uint8Array; filename: string; mimeType: string } }>) => {
  const message = event.data;
  queue = queue.then(async () => {
    try {
      const sealer = await prepare();
      const result = message.command === "ready" ? await sealer.ready()
        : message.command === "enroll" ? await sealer.enroll()
        : await sealer.seal(message.input!);
      self.postMessage({ id: message.id, result });
    } catch (error) {
      self.postMessage({ id: message.id, error: error instanceof Error ? error.message : "wildz_local_seal_failed" });
    }
  });
};
