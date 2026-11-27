import type { ReceizOfflineSealResources } from "@receiz/sdk/offline";

let pending: Promise<ReceizOfflineSealResources> | undefined;

export function loadWildzLocalSealResources() {
  return pending ??= (async () => {
    const load = async (path: string) => {
      const response = await fetch(path, { credentials: "omit" }).catch(() => null);
      if (!response?.ok) throw Error("wildz_offline_seal_resources_unavailable");
      return new Uint8Array(await response.arrayBuffer());
    };
    const [wasm, zkey] = await Promise.all([
      load("/zk/document_seal_proof_js/sigil_proof.wasm"), load("/zk/document_seal_proof_final.zkey"),
    ]);
    return { wasm, zkey };
  })().catch(error => { pending = undefined; throw error; });
}
