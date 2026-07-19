import type { WildzIdentitySession } from "./wildz-identity-repository";
import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";

export type WildzRemoteSession =
  | {
      status: "connected";
      subjectKey: string;
      sessionKeyId?: string;
      authority?: "identity-key" | "proof-sealed-vault";
      vaultCardRootSha256?: string;
      actorId: string;
      profileHandle: string;
      displayName: string | null;
    }
  | {
      status: "unknown" | "pending" | "offline" | "unavailable";
      actorId: null;
      profileHandle: null;
      displayName: null;
    };

export interface WildzRemoteSessionBridge {
  current(): Promise<WildzRemoteSession>;
  commitVaultAdmission(input: {
    actorId: string;
    profileHandle: string;
    vaultKeyId: string;
  }): Promise<WildzRemoteSession>;
  disconnect(): Promise<WildzRemoteSession>;
}

export type WildzSharedWorldBootstrap = {
  ok: true;
  mode: "receiz_live";
  projection: {
    schema: "receiz.wilds_world_projection.v3";
    worldId: "wilds:global:v3";
    revision: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export class WildzWorldConnectRequiredError extends Error {
  readonly connectUrl: string;

  constructor(connectUrl: string) {
    super("wilds_world_connect_required");
    this.name = "WildzWorldConnectRequiredError";
    this.connectUrl = connectUrl;
  }
}

const UNKNOWN_REMOTE_SESSION: WildzRemoteSession = {
  status: "unknown",
  actorId: null,
  profileHandle: null,
  displayName: null
};

function disconnected(status: "unknown" | "pending" | "offline" | "unavailable"): WildzRemoteSession {
  return { status, actorId: null, profileHandle: null, displayName: null };
}

function remoteSession(value: unknown): WildzRemoteSession {
  if (!value || typeof value !== "object") return UNKNOWN_REMOTE_SESSION;
  const candidate = value as {
    status?: unknown;
    subjectKey?: unknown;
    sessionKeyId?: unknown;
    authority?: unknown;
    vaultCardRootSha256?: unknown;
    actorId?: unknown;
    profileHandle?: unknown;
    displayName?: unknown;
  };
  if (candidate.status === "connected"
    && typeof candidate.subjectKey === "string"
    && /^[a-f0-9]{64}$/.test(candidate.subjectKey)
    && typeof candidate.actorId === "string"
    && typeof candidate.profileHandle === "string"
    && (typeof candidate.displayName === "string" || candidate.displayName === null)) {
    const coordinate = parseWildzPlayerCoordinate(candidate.profileHandle);
    if (coordinate?.actorId === candidate.actorId) {
      return {
        status: "connected",
        subjectKey: candidate.subjectKey,
        ...(typeof candidate.sessionKeyId === "string"
          && /^(?:receiz_vault_[a-f0-9]{32}|[A-Za-z0-9._:-]{8,200})$/.test(candidate.sessionKeyId)
          && (candidate.authority === "identity-key" || candidate.authority === "proof-sealed-vault")
          ? { sessionKeyId: candidate.sessionKeyId, authority: candidate.authority }
          : {}),
        ...(typeof candidate.vaultCardRootSha256 === "string"
          && /^sha256:[a-f0-9]{64}$/.test(candidate.vaultCardRootSha256)
          ? { vaultCardRootSha256: candidate.vaultCardRootSha256 }
          : {}),
        ...coordinate,
        displayName: candidate.displayName
      };
    }
  }
  if (candidate.status === "pending" || candidate.status === "offline" || candidate.status === "unavailable") {
    return { status: candidate.status, actorId: null, profileHandle: null, displayName: null };
  }
  return UNKNOWN_REMOTE_SESSION;
}

export async function bootstrapWildzSharedWorld(
  fetcher: typeof fetch = globalThis.fetch
): Promise<WildzSharedWorldBootstrap> {
  try {
    const response = await fetcher("/api/wilds/world/bootstrap", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store"
    });
    const value = await response.json().catch(() => null) as Record<string, unknown> | null;
    const projection = value?.projection as Record<string, unknown> | undefined;
    if (!response.ok) {
      if ((value?.error === "wilds_world_connect_required"
          || value?.error === "wilds_world_connect_identity_mismatch")
        && typeof value.connectUrl === "string"
        && value.connectUrl.startsWith("/api/auth/receiz/start?")) {
        throw new WildzWorldConnectRequiredError(value.connectUrl);
      }
      throw new Error("wildz_world_bootstrap_unavailable");
    }
    if (value?.ok !== true
      || value.mode !== "receiz_live"
      || projection?.schema !== "receiz.wilds_world_projection.v3"
      || projection.worldId !== "wilds:global:v3"
      || !Number.isSafeInteger(projection.revision)
      || Number(projection.revision) < 1) {
      throw new Error("wildz_world_bootstrap_unavailable");
    }
    return value as WildzSharedWorldBootstrap;
  } catch (error) {
    if (error instanceof WildzWorldConnectRequiredError) throw error;
    throw new Error("wildz_world_bootstrap_unavailable");
  }
}

export function wildzRemoteSessionMatchesIdentity(
  session: WildzIdentitySession,
  remote: WildzRemoteSession
) {
  if (remote.status !== "connected") return false;
  if (session.localAuthority === "proof-sealed-vault") {
    return remote.authority === "proof-sealed-vault"
      && remote.sessionKeyId === session.keyId
      && remote.actorId === session.actorId;
  }
  if (session.localAuthority === "verified") {
    return remote.authority === "identity-key"
      && remote.sessionKeyId === session.keyId;
  }
  return remote.actorId === session.actorId
    && session.keyId === `receiz_remote_${remote.subjectKey.slice(0, 32)}`;
}

export function reconcileWildzRemoteIdentitySession(
  session: WildzIdentitySession,
  remote: WildzRemoteSession
): { session: WildzIdentitySession; disconnect: boolean } {
  if (remote.status === "connected") {
    const expectedKeyId = `receiz_remote_${remote.subjectKey.slice(0, 32)}`;
    const coordinate = parseWildzPlayerCoordinate(remote.profileHandle);
    const remoteOnlySubjectBound = session.localAuthority === "remote-only";
    if ((remoteOnlySubjectBound && expectedKeyId !== session.keyId)
      || coordinate?.actorId !== session.actorId) {
      return { session: { ...session, remoteStatus: "unavailable" }, disconnect: true };
    }
    return {
      session: {
        ...session,
        username: remote.actorId,
        displayName: remote.displayName,
        remoteStatus: "connected"
      },
      disconnect: false
    };
  }
  return { session: { ...session, remoteStatus: remote.status }, disconnect: false };
}

export function createWildzRemoteSessionBridge(options: {
  fetcher?: typeof fetch;
} = {}): WildzRemoteSessionBridge {
  const fetcher = options.fetcher ?? globalThis.fetch;

  return {
    async current() {
      try {
        const response = await fetcher("/api/auth/wildz/session", { cache: "no-store", credentials: "same-origin" });
        return response.ok ? remoteSession(await response.json()) : disconnected("unavailable");
      } catch {
        return disconnected("offline");
      }
    },
    async commitVaultAdmission(input) {
      try {
        const response = await fetcher("/api/auth/wildz/vault-session", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            "x-wildz-session-intent": "vault-commit"
          },
          body: JSON.stringify(input)
        });
        return response.ok ? remoteSession(await response.json()) : disconnected("unavailable");
      } catch {
        return disconnected("offline");
      }
    },
    async disconnect() {
      try {
        await fetcher("/api/auth/wildz/session", {
          method: "DELETE",
          cache: "no-store",
          credentials: "same-origin"
        });
      } catch {
        return disconnected("offline");
      }
      return UNKNOWN_REMOTE_SESSION;
    }
  };
}

export const wildzRemoteSessionBridge = createWildzRemoteSessionBridge();
