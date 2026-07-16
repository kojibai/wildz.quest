import { readFile } from "node:fs/promises";
import {
  createReceizClient,
  ReceizHttpError,
  receizOidcScopesForRails
} from "@receiz/sdk";

const TARGET_MAJOR = 104;
const REQUIRED_STRICT_CAPABILITIES = [
  "identity",
  "wallet",
  "payments",
  "proofStore",
  "world",
  "portability",
  "releases"
];
const LIVE_PROBE_TIMEOUT_MS = 8_000;

async function readJson(url) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch {
    return null;
  }
}

function semverMajor(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^[~^]?(\d+)\./);
  return match ? Number(match[1]) : null;
}

function versionDetails(requested, installed) {
  const requestedVersion = requested ?? "missing";
  const installedVersion = installed ?? "missing";
  return {
    requested: requestedVersion,
    installed: installedVersion,
    requestedMajor: semverMajor(requestedVersion),
    installedMajor: semverMajor(installedVersion)
  };
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function exact(value) {
  return (candidate) => candidate === value;
}

function validHttpsUrl(value) {
  if (!nonEmpty(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function atLeast32Bytes(value) {
  return nonEmpty(value) && new TextEncoder().encode(value).byteLength >= 32;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function successfulRecord(value) {
  return isRecord(value) && value.ok !== false;
}

function authenticatedIdentity(value) {
  if (!successfulRecord(value)) return false;
  return ["sub", "id", "handle", "preferred_username", "username"]
    .some((key) => nonEmpty(value[key]));
}

function boundedFetch(input, init = {}) {
  const signal = typeof AbortSignal?.timeout === "function"
    ? AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS)
    : undefined;
  return fetch(input, { ...init, ...(signal ? { signal } : {}) });
}

async function runLiveReadProbes(client, tenantHost) {
  const liveProbes = Object.fromEntries(
    REQUIRED_STRICT_CAPABILITIES.map((name) => [name, "not-checked"])
  );
  const liveProbeIssueCodes = [];
  const probes = {
    identity: async () => authenticatedIdentity(await client.identity.userinfo()),
    wallet: async () => successfulRecord(await client.connect.wallet()),
    payments: async () => {
      try {
        return successfulRecord(await client.connect.checkoutSession({
          sessionId: "wildz-release-readiness-probe"
        }));
      } catch (error) {
        if (error instanceof ReceizHttpError && (error.status === 400 || error.status === 404)) return true;
        throw error;
      }
    },
    proofStore: async () => successfulRecord(await client.proof.query({
      namespace: "wildz:release:readiness",
      tenantHost,
      limit: 1
    })),
    world: async () => successfulRecord(await client.world.publicSnapshot()),
    portability: async () => successfulRecord(await client.portability.exportStore({ tenantHost })),
    releases: async () => successfulRecord(await client.releases.check({ tenantHost }))
  };

  await Promise.all(REQUIRED_STRICT_CAPABILITIES.map(async (name) => {
    try {
      const verified = await probes[name]();
      liveProbes[name] = verified ? "verified" : "failed";
      if (!verified) liveProbeIssueCodes.push(`${name}_probe_failed`);
    } catch {
      liveProbes[name] = "failed";
      liveProbeIssueCodes.push(`${name}_probe_failed`);
    }
  }));

  return {
    liveProbes,
    liveProbeIssueCodes: [...new Set(liveProbeIssueCodes)].sort()
  };
}

const STRICT_ENVIRONMENT_RULES = [
  ["NEXT_PUBLIC_RECEIZ_MODE", exact("live")],
  ["RECEIZ_BASE_URL", validHttpsUrl],
  ["RECEIZ_CLIENT_ID", nonEmpty],
  ["RECEIZ_CLIENT_SECRET", nonEmpty],
  ["RECEIZ_OAUTH_STATE_SECRET", atLeast32Bytes],
  ["NEXT_PUBLIC_AUTH_MODE", exact("receiz_id")],
  ["RECEIZ_AUTH_MODE", exact("receiz_id")],
  ["RECEIZ_ID_CALLBACK_URL", exact("https://wildz.quest/api/auth/receiz/callback")],
  ["NEXT_PUBLIC_SITE_URL", exact("https://wildz.quest")],
  ["NEXT_PUBLIC_CHECKOUT_MODE", exact("receiz")],
  ["RECEIZ_CHECKOUT_MODE", exact("receiz")],
  ["RECEIZ_ACCESS_TOKEN", nonEmpty],
  ["WILDS_PULSE_TICK_SECRET", atLeast32Bytes],
  ["RECEIZ_CONNECT_ACCESS_TOKEN", nonEmpty]
];

const pkg = await readJson(new URL("../package.json", import.meta.url));
const installedSdk = await readJson(new URL("../node_modules/@receiz/sdk/package.json", import.meta.url));
const installedMcp = await readJson(new URL("../node_modules/@receiz/mcp-server/package.json", import.meta.url));
const installedAiSkills = await readJson(new URL("../node_modules/@receiz/ai-skills/package.json", import.meta.url));
const sdk = versionDetails(pkg?.dependencies?.["@receiz/sdk"], installedSdk?.version);
const mcp = versionDetails(pkg?.devDependencies?.["@receiz/mcp-server"], installedMcp?.version);
const aiSkills = versionDetails(pkg?.devDependencies?.["@receiz/ai-skills"], installedAiSkills?.version);
const compatible = [
  sdk.requestedMajor,
  sdk.installedMajor,
  mcp.requestedMajor,
  mcp.installedMajor,
  aiSkills.requestedMajor,
  aiSkills.installedMajor
]
  .every((value) => value === TARGET_MAJOR);
const present = (name) => Boolean(process.env[name]);
const strictLive = process.argv.slice(2).includes("--strict-live");

if (strictLive) {
  const missingEnvironment = STRICT_ENVIRONMENT_RULES
    .filter(([name, validate]) => !validate(process.env[name]))
    .map(([name]) => name);
  const requiredCapabilities = Object.fromEntries(
    REQUIRED_STRICT_CAPABILITIES.map((name) => [name, "not-checked"])
  );
  let sdkIssueCodes = [];
  let doctorOk = false;
  let walletTransferScope = false;
  let liveProbes = Object.fromEntries(
    REQUIRED_STRICT_CAPABILITIES.map((name) => [name, "not-checked"])
  );
  let liveProbeIssueCodes = [];

  if (missingEnvironment.length === 0) {
    try {
      const scopes = receizOidcScopesForRails(
        "identity",
        "wallet",
        "payments",
        "proofStore",
        "world",
        "appState",
        "publicStore",
        "portability",
        "releases"
      );
      walletTransferScope = scopes.includes("receiz:wallet.transfer");
      const client = createReceizClient({
        baseUrl: process.env.RECEIZ_BASE_URL,
        accessToken: process.env.RECEIZ_ACCESS_TOKEN,
        fetchImpl: boundedFetch
      });
      const tenantHost = new URL(process.env.NEXT_PUBLIC_SITE_URL).host;
      const doctor = await client.doctor({
        tenantHost,
        callbackUrl: process.env.RECEIZ_ID_CALLBACK_URL,
        scopes
      });
      for (const name of REQUIRED_STRICT_CAPABILITIES) {
        requiredCapabilities[name] = doctor.capabilities[name]?.status ?? "unknown";
      }
      sdkIssueCodes = [...new Set([...doctor.missing, ...doctor.warnings].map((issue) => issue.code))].sort();
      doctorOk = doctor.ok;
      if (doctorOk) {
        ({ liveProbes, liveProbeIssueCodes } = await runLiveReadProbes(client, tenantHost));
      }
    } catch {
      sdkIssueCodes = ["doctor_failed"];
    }
  }

  const capabilitiesAvailable = Object.values(requiredCapabilities)
    .every((status) => status === "available");
  const liveProbesVerified = Object.values(liveProbes)
    .every((status) => status === "verified");
  const ok = compatible
    && missingEnvironment.length === 0
    && doctorOk
    && walletTransferScope
    && capabilitiesAvailable
    && liveProbesVerified;
  console.log(JSON.stringify({
    mode: "strict-live",
    sdkVersion: installedSdk?.version ?? "missing",
    ok,
    requiredCapabilities,
    liveProbes,
    missingEnvironment,
    sdkIssueCodes,
    liveProbeIssueCodes
  }, null, 2));
  if (!ok) process.exitCode = 1;
} else {

  const report = {
    product: "Wildz",
    sdk: sdk.requested,
    mcpCompatibility: mcp.requested,
    aiSkillsCompatibility: aiSkills.requested,
    versions: {
      targetMajor: TARGET_MAJOR,
      compatible,
      sdk,
      mcp,
      aiSkills
    },
    capabilities: {
      identity: "local-available",
      identityArtifacts: "local-available",
      portableProofs: "local-available",
      liveApi: present("RECEIZ_ACCESS_TOKEN") ? "configured" : "needs-env",
      checkout: present("RECEIZ_ACCESS_TOKEN") ? "configured" : "needs-env",
      webhooks: present("RECEIZ_WEBHOOK_SECRET") ? "configured" : "needs-env"
    }
  };

  console.log(JSON.stringify(report, null, 2));
  if (!compatible) process.exitCode = 1;
}
