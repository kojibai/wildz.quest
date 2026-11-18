import { createReceizOfflineSealer } from "@receiz/sdk/offline";
import { createWildzBrowserSealStore } from "./store";

let runtime: Promise<ReturnType<typeof createReceizOfflineSealer>> | undefined;
function prepare() {
  return runtime ??= (async () => {
    const load = async (path: string) => {
      const response = await fetch(path, { credentials: "omit" }).catch(() => null);
      if (!response?.ok) throw new Error("wildz_offline_seal_resources_unavailable");
      return new Uint8Array(await response.arrayBuffer());
    };
    const [wasm, zkey] = await Promise.all([load("/zk/document_seal_proof_js/sigil_proof.wasm"), load("/zk/document_seal_proof_final.zkey")]);
    const resources = { wasm, zkey };
    return createReceizOfflineSealer({ resources, store: await createWildzBrowserSealStore(resources),
      enrollmentUrl: "/api/receiz/local-signer/enroll",
      fetch: (url, init) => fetch(url, init).catch(() => { throw new Error("wildz_local_enrollment_unreachable"); })
    });
  })().catch(error => { runtime = undefined; throw error; });
}
// Serialize enrollment and proving to bound memory and prevent duplicate custody.
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<{ id: number; command: "ready" | "enroll" | "seal"; input?: { bytes: Uint8Array; filename: string; mimeType: string } }>) => {
  const message = event.data;
  queue = queue.then(async () => {
    try {
      const sealer = await prepare();
      if (message.command === "seal") {
        const { artifactBytes, filename, mimeType } = await sealer.seal(message.input!);
        const buffer = artifactBytes.buffer instanceof ArrayBuffer && artifactBytes.byteLength === artifactBytes.buffer.byteLength
          ? artifactBytes.buffer : new Uint8Array(artifactBytes).buffer;
        const scope = self as unknown as DedicatedWorkerGlobalScope;
        scope.postMessage({ id: message.id, result: { artifactBytes: new Uint8Array(buffer), filename, mimeType } }, [buffer]);
      } else {
        const result = message.command === "ready" ? await sealer.ready() : await sealer.enroll();
        self.postMessage({ id: message.id, result });
      }
    } catch (error) {
      self.postMessage({ id: message.id, error: error instanceof Error ? error.message : "wildz_local_seal_failed" });
    }
  });
};
