/** One-key readiness only removes redundant initialization reads. It confers no
 * authority: every later native source request still verifies account and heads. */
export function createWildsWalletNativeSourceInitializer(initialize: (keyId: string) => Promise<void>) {
  let readyKeyId: string | null = null;
  let pending: Readonly<{keyId: string; promise: Promise<void>}> | null = null;
  return (keyId: string): Promise<void> => {
    if (readyKeyId === keyId) return Promise.resolve();
    if (pending?.keyId === keyId) return pending.promise;
    const promise = Promise.resolve().then(() => initialize(keyId));
    const operation = {keyId, promise};
    pending = operation;
    void promise.then(() => {
      if (pending === operation) {readyKeyId = keyId; pending = null;}
    }, () => {if (pending === operation) pending = null;});
    return promise;
  };
}
