import { createReceizIndexedDbSealStore, createReceizOfflineSealer,
  type ReceizOfflineSealEnrollment, type ReceizOfflineSealResources } from "@receiz/sdk/offline";

/** Read the previous origin-local device key without exporting private material. */
async function previousEnrollment(): Promise<ReceizOfflineSealEnrollment | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("receiz.signatureV4.device.v1", 1);
    request.onupgradeneeded = () => { request.transaction?.abort(); resolve(null); };
    request.onerror = () => request.error?.name === "AbortError" ? resolve(null) : reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("enrollment")) { database.close(); resolve(null); return; }
      const transaction = database.transaction("enrollment", "readonly");
      const read = transaction.objectStore("enrollment").get("active");
      read.onsuccess = () => resolve(read.result ? { privateKey: read.result.privateKey, cert: read.result.cert } : null);
      read.onerror = () => reject(read.error);
      transaction.oncomplete = () => database.close();
      transaction.onabort = () => database.close();
    };
  });
}

export async function createWildzBrowserSealStore(resources: ReceizOfflineSealResources) {
  const store = createReceizIndexedDbSealStore();
  if (!await store.load()) {
    const previous = await previousEnrollment();
    if (previous) {
      const candidate = createReceizOfflineSealer({ resources,
        store: { load: async () => previous, save: async () => { throw new Error("read_only"); } } });
      if (!await candidate.ready()) throw new Error("wildz_local_signer_not_ready");
      try { await store.save(previous); }
      catch (error) { if (!await store.load()) throw error; }
    }
  }
  return store;
}
