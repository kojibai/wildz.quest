import {
  STORE_STATE_SCHEMA,
  isStoreStateRecord,
  storeStateRecordMatchesTenantHost,
  type StoreStateRecord
} from "./proof-state";
import type { ProofStateStore } from "./proof-state-store";
import { RECEIZ_PUBLIC_STORE_STATE_PROJECTION_SCHEMA } from "@receiz/sdk";

const DEFAULT_LEDGER_LIMIT = 500;
const DEFAULT_RECOVERY_TIMEOUT_MS = 1500;
const MAX_RECOVERY_TIMEOUT_MS = 5000;
const MIN_RECOVERY_TIMEOUT_MS = 25;
const RECOVERY_TIMED_OUT = Symbol("receiz_store_state_recovery_timed_out");

export type StoreStateRecoveryOptions = {
  timeoutMs?: number;
};

function ledgerLimit() {
  const parsed = Number.parseInt(process.env.RECEIZ_STORE_STATE_LEDGER_LIMIT ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : DEFAULT_LEDGER_LIMIT;
}

function boundedTimeoutMs(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(parsed, MIN_RECOVERY_TIMEOUT_MS), MAX_RECOVERY_TIMEOUT_MS);
}

function recoveryTimeoutMs(options?: StoreStateRecoveryOptions) {
  return boundedTimeoutMs(
    options?.timeoutMs ?? process.env.RECEIZ_STORE_STATE_RECOVERY_TIMEOUT_MS,
    DEFAULT_RECOVERY_TIMEOUT_MS
  );
}

function unrefTimer(timer: ReturnType<typeof setTimeout>) {
  if (typeof timer === "object" && "unref" in timer && typeof timer.unref === "function") {
    timer.unref();
  }
}

async function withRecoveryTimeout<T>(
  label: string,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T | null> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<typeof RECOVERY_TIMED_OUT>((resolve) => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve(RECOVERY_TIMED_OUT);
    }, timeoutMs);
    unrefTimer(timeout);
  });

  try {
    const result = await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeoutPromise]);

    if (result === RECOVERY_TIMED_OUT) {
      console.warn("[store] Receiz store-state recovery timed out", { rail: label, timeoutMs });
      return null;
    }

    return result as T;
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function uniqueRecords(records: StoreStateRecord[]) {
  const unique = new Map<string, StoreStateRecord>();

  for (const record of records) {
    unique.set(record.id, record);
  }

  return [...unique.values()];
}

function collectStoreStateRecords(value: unknown, depth = 0, seen = new WeakSet<object>()): StoreStateRecord[] {
  if (depth > 8 || value === null || value === undefined) return [];

  if (isStoreStateRecord(value)) return [value];

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStoreStateRecords(item, depth + 1, seen));
  }

  if (typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  return Object.values(value).flatMap((item) => collectStoreStateRecords(item, depth + 1, seen));
}

export function extractStoreStateRecords(value: unknown): StoreStateRecord[] {
  return uniqueRecords(collectStoreStateRecords(value));
}

export type ReceizPublicStoreStateRecoveryAdapter = {
  restoreLatestPublicStore(input: { host: string; requiredSchema?: string }): Promise<unknown>;
  resolvePublicStore(input: { host: string }): Promise<unknown>;
  readAppStateByUrl(url: string): Promise<unknown>;
  resolveTenant(
    host: string,
    options?: { schema?: string; state?: string; requiredDataKey?: string }
  ): Promise<unknown>;
};

async function createRecoveryAdapter(): Promise<ReceizPublicStoreStateRecoveryAdapter> {
  const { createReceizCommerceAdapter } = await import("./adapter");

  return createReceizCommerceAdapter({
    baseUrl: process.env.RECEIZ_BASE_URL
  });
}

export async function recoverReceizPublicProofStoreStateRecords(
  tenantHost: string,
  receiz?: ReceizPublicStoreStateRecoveryAdapter,
  options?: StoreStateRecoveryOptions
) {
  const recoveryAdapter = receiz ?? await createRecoveryAdapter();
  const normalizedHost = tenantHost.trim().toLowerCase();
  const urls = [`https://${normalizedHost}`, `https://${normalizedHost}/`];
  const timeoutMs = recoveryTimeoutMs(options);
  const recover = async (label: string, operation: (signal: AbortSignal) => Promise<unknown>) => {
    const restored = await withRecoveryTimeout(label, timeoutMs, operation);
    return extractStoreStateRecords(restored);
  };

  const recovered = await Promise.all([
    recover("publicStore.restoreLatest", () => recoveryAdapter.restoreLatestPublicStore({
      host: normalizedHost,
      requiredSchema: STORE_STATE_SCHEMA
    })),
    recover("publicStore.resolve", () => recoveryAdapter.resolvePublicStore({
      host: normalizedHost
    })),
    recover("resolveTenant", () => recoveryAdapter.resolveTenant(normalizedHost, {
      schema: RECEIZ_PUBLIC_STORE_STATE_PROJECTION_SCHEMA,
      state: "published",
      requiredDataKey: "storeStateRecord"
    })),
    ...urls.map((url) => recover(`appState.byUrl:${url}`, () => recoveryAdapter.readAppStateByUrl(url)))
  ]);

  return uniqueRecords(recovered.flat()).filter((record) => storeStateRecordMatchesTenantHost(record, tenantHost));
}

export async function recoverReceizStoreStateRecords(tenantHost: string, options?: StoreStateRecoveryOptions) {
  const timeoutMs = recoveryTimeoutMs(options);
  const ledgerRecords = withRecoveryTimeout("actionLedger", timeoutMs, async () => {
    const { createReceizCommerceAdapter } = await import("./adapter");
    const receiz = createReceizCommerceAdapter({
      baseUrl: process.env.RECEIZ_BASE_URL
    });
    const ledger = await receiz.actionLedger({ limit: ledgerLimit() });

    return extractStoreStateRecords(ledger).filter((record) =>
      storeStateRecordMatchesTenantHost(record, tenantHost)
    );
  });
  const publicProofRecords = recoverReceizPublicProofStoreStateRecords(tenantHost, undefined, options).catch(() => []);
  const recovered = await Promise.all([ledgerRecords, publicProofRecords]);
  const records = recovered.flatMap((records) => records ?? []);

  return uniqueRecords(records);
}

export async function admitRecoveredStoreStateRecords(
  proofStore: ProofStateStore,
  tenantHost: string,
  recovered: StoreStateRecord[]
) {
  const knownRecordIds = new Set(
    proofStore
      .records()
      .filter((record) => isStoreStateRecord(record) && storeStateRecordMatchesTenantHost(record, tenantHost))
      .map((record) => record.id)
  );
  const matchingRecords = recovered.filter((record) => storeStateRecordMatchesTenantHost(record, tenantHost));
  let admitted = 0;

  for (const record of matchingRecords) {
    if (!knownRecordIds.has(record.id)) admitted += 1;
    await proofStore.admitStoreRecord(record);
  }

  return { admitted, recovered: matchingRecords.length };
}

export async function hydrateProofStoreFromReceizStoreState(
  proofStore: ProofStateStore,
  tenantHost: string,
  options?: StoreStateRecoveryOptions
) {
  const recovered = await recoverReceizStoreStateRecords(tenantHost, options);

  return admitRecoveredStoreStateRecords(proofStore, tenantHost, recovered);
}
