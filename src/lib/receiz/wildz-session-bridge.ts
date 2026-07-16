import type { WildzIdentitySession } from "./wildz-identity-repository";
import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";

export type WildzRemoteSession =
  | {
      status: "connected";
      subjectKey: string;
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
  continueLocalIdentity(session: WildzIdentitySession, returnTo?: string): Promise<WildzRemoteSession>;
  disconnect(): Promise<WildzRemoteSession>;
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

export function reconcileWildzRemoteIdentitySession(
  session: WildzIdentitySession,
  remote: WildzRemoteSession
): { session: WildzIdentitySession; disconnect: boolean } {
  if (remote.status === "connected") {
    const expectedKeyId = `receiz_remote_${remote.subjectKey.slice(0, 32)}`;
    const coordinate = parseWildzPlayerCoordinate(remote.profileHandle);
    const proofBackedVault = /^receiz_vault_[a-f0-9]{32,64}$/.test(session.keyId);
    const remoteOnlySubjectBound = session.localAuthority === "remote-only" && !proofBackedVault;
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
  navigate?: (url: string) => void;
} = {}): WildzRemoteSessionBridge {
  const fetcher = options.fetcher ?? globalThis.fetch;
  const navigate = options.navigate ?? ((url: string) => window.location.assign(url));

  return {
    async current() {
      try {
        const response = await fetcher("/api/auth/receiz/me", { cache: "no-store", credentials: "same-origin" });
        return response.ok ? remoteSession(await response.json()) : disconnected("unavailable");
      } catch {
        return disconnected("offline");
      }
    },
    async continueLocalIdentity(session, returnTo = "/") {
      const coordinate = parseWildzPlayerCoordinate(session.username ?? session.actorId);
      if (!coordinate) return disconnected("unavailable");
      const search = new URLSearchParams({ returnTo, usernameHint: coordinate.actorId });
      navigate(`/api/auth/receiz/start?${search.toString()}`);
      return disconnected("pending");
    },
    async disconnect() {
      try {
        await fetcher("/api/auth/receiz/me", {
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
