type SendContext = Readonly<{ open: boolean; page: string; identityKey: string; sourceKey: string; authorityGeneration: string }>;
const same = (left: SendContext, right: SendContext) => right.open && right.page === "send" && left.identityKey === right.identityKey && left.sourceKey === right.sourceKey && left.authorityGeneration === right.authorityGeneration;
/** Runs only from explicit Send actions, and cannot refresh a later account/review. */
export function createWildsWalletSendReadiness(input: { current(): SendContext; continueSession(expected: SendContext): Promise<boolean>; refresh(): Promise<unknown> }) {
  let pending: { context: SendContext; operation: Promise<boolean> } | null = null;
  let ready: SendContext | null = null;
  return function ensure(): Promise<boolean> {
    const context = input.current();
    if (!context.open || context.page !== "send") return Promise.resolve(false);
    if (ready && same(ready, context)) return Promise.resolve(true);
    if (pending && same(pending.context, context)) return pending.operation;
    const operation = (async () => {
      try {
        if (!await input.continueSession(context) || !same(context, input.current())) return false;
        await input.refresh();
        if (!same(context, input.current())) return false;
        ready = context;
        return true;
      } catch (cause) {
        if (!same(context, input.current())) return false;
        throw cause;
      }
    })();
    pending = { context, operation };
    void operation.finally(() => { if (pending?.operation === operation) pending = null; }).catch(() => undefined);
    return operation;
  };
}
