import type { CommerceState, CustomerAccount, ReceizIdState } from "@/types/domain";

export type TenantCustomerSession = {
  version: 1;
  tenantHost: string | null;
  savedAt: string;
  customer: CustomerAccount;
  receizId: ReceizIdState;
};

export type BrowserReceizIdSession = {
  version: 1;
  savedAt: string;
  customer: CustomerAccount;
  receizId: ReceizIdState;
  keyFile?: unknown;
};

export const BROWSER_RECEIZ_ID_SESSION_KEY = "receiz-app-commerce-state-v1:browser-receiz-id-session-v1";

export function tenantCustomerSessionKey(storageKey: string) {
  return `${storageKey}:customer-session-v1`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCustomerAccount(value: unknown): value is CustomerAccount {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    typeof value.tier === "string" &&
    typeof value.rewardsValueLabel === "string" &&
    typeof value.beans === "number" &&
    typeof value.streak === "string" &&
    isStringArray(value.orderIds) &&
    isStringArray(value.rewardIds) &&
    isStringArray(value.assetIds)
  );
}

function isReceizIdState(value: unknown): value is ReceizIdState {
  if (!isRecord(value)) return false;

  return (
    value.connected === true &&
    typeof value.handle === "string" &&
    typeof value.displayName === "string" &&
    typeof value.keyId === "string" &&
    typeof value.loginMode === "string" &&
    typeof value.accountImageLabel === "string" &&
    typeof value.artifactKind === "string" &&
    typeof value.artifactStatus === "string" &&
    typeof value.portableStateStatus === "string" &&
    typeof value.localProofVerified === "boolean" &&
    Array.isArray(value.restoreSources) &&
    typeof value.oneClickLogin === "boolean" &&
    typeof value.existingIdsSupported === "boolean" &&
    Array.isArray(value.sdkHelpers) &&
    typeof value.statusLabel === "string"
  );
}

function upsertCustomer(customers: CustomerAccount[], customer: CustomerAccount) {
  if (!customers.some((item) => item.id === customer.id || item.receizHandle === customer.receizHandle)) {
    return [customer, ...customers];
  }

  return customers.map((item) =>
    item.id === customer.id || item.receizHandle === customer.receizHandle
      ? { ...item, ...customer }
      : item
  );
}

export function buildTenantCustomerSession(
  state: CommerceState,
  tenantHost: string | null,
  savedAt = new Date().toISOString()
): TenantCustomerSession | null {
  if (!state.auth.receizId.connected || state.auth.signedInAs !== "customer") return null;

  return {
    version: 1,
    tenantHost,
    savedAt,
    customer: state.auth.customer,
    receizId: state.auth.receizId
  };
}

function customerFromReceizId(state: CommerceState): CustomerAccount {
  const handle = state.auth.receizId.handle;
  const id = `customer-${handle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "receiz-id"}`;
  const current = state.auth.signedInAs === "customer" ? state.auth.customer : state.customers[0] ?? state.auth.customer;

  return {
    ...current,
    id: current.id || id,
    name: state.auth.receizId.displayName || current.name || "Receiz customer",
    email: current.email || `${handle.replace(/\.receiz\.id$/i, "")}@receiz.local`,
    receizHandle: handle,
    tier: current.tier || "Member"
  };
}

export function buildBrowserReceizIdSession(
  state: CommerceState,
  keyFile?: unknown,
  savedAt = new Date().toISOString()
): BrowserReceizIdSession | null {
  if (!state.auth.receizId.connected) return null;

  return {
    version: 1,
    savedAt,
    customer: customerFromReceizId(state),
    receizId: state.auth.receizId,
    keyFile
  };
}

export function parseTenantCustomerSession(raw: string | null): TenantCustomerSession | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    if (value.version !== 1) return null;
    if (typeof value.savedAt !== "string") return null;
    if (!(typeof value.tenantHost === "string" || value.tenantHost === null)) return null;
    if (!isCustomerAccount(value.customer)) return null;
    if (!isReceizIdState(value.receizId)) return null;

    return {
      version: 1,
      tenantHost: value.tenantHost,
      savedAt: value.savedAt,
      customer: value.customer,
      receizId: value.receizId
    };
  } catch {
    return null;
  }
}

export function parseBrowserReceizIdSession(raw: string | null): BrowserReceizIdSession | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    if (value.version !== 1) return null;
    if (typeof value.savedAt !== "string") return null;
    if (!isCustomerAccount(value.customer)) return null;
    if (!isReceizIdState(value.receizId)) return null;

    return {
      version: 1,
      savedAt: value.savedAt,
      customer: value.customer,
      receizId: value.receizId,
      keyFile: value.keyFile
    };
  } catch {
    return null;
  }
}

export function applyTenantCustomerSession(
  state: CommerceState,
  session: TenantCustomerSession | null
): CommerceState {
  if (!session) return state;

  return {
    ...state,
    customers: upsertCustomer(state.customers, session.customer),
    auth: {
      ...state.auth,
      signedInAs: "customer",
      customer: session.customer,
      receizId: {
        ...state.auth.receizId,
        ...session.receizId,
        connected: true
      }
    }
  };
}

export function applyBrowserReceizIdSession(
  state: CommerceState,
  session: BrowserReceizIdSession | null
): CommerceState {
  if (!session) return state;

  const handle = session.receizId.handle;
  const customerId = `customer-${handle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "receiz-id"}`;
  const customer: CustomerAccount = {
    id: customerId,
    name: session.receizId.displayName || session.customer.name || "Receiz customer",
    email: session.customer.email || `${handle.replace(/\.receiz\.id$/i, "")}@receiz.local`,
    tier: "Member",
    rewardsValueLabel: "$0.00",
    beans: 0,
    streak: "0x",
    orderIds: [],
    rewardIds: [],
    assetIds: [],
    receizHandle: handle,
    shippingAddress: session.customer.shippingAddress
  };

  return applyTenantCustomerSession(state, {
    version: 1,
    tenantHost: null,
    savedAt: session.savedAt,
    customer,
    receizId: session.receizId
  });
}
