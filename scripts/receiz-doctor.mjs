import { readFile } from "node:fs/promises";

const TARGET_MAJOR = 101;

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

const pkg = await readJson(new URL("../package.json", import.meta.url));
const installedSdk = await readJson(new URL("../node_modules/@receiz/sdk/package.json", import.meta.url));
const installedMcp = await readJson(new URL("../node_modules/@receiz/mcp-server/package.json", import.meta.url));
const sdk = versionDetails(pkg?.dependencies?.["@receiz/sdk"], installedSdk?.version);
const mcp = versionDetails(pkg?.devDependencies?.["@receiz/mcp-server"], installedMcp?.version);
const compatible = [sdk.requestedMajor, sdk.installedMajor, mcp.requestedMajor, mcp.installedMajor]
  .every((value) => value === TARGET_MAJOR);
const present = (name) => Boolean(process.env[name]);

const report = {
  product: "Wildz",
  sdk: sdk.requested,
  mcpCompatibility: mcp.requested,
  versions: {
    targetMajor: TARGET_MAJOR,
    compatible,
    sdk,
    mcp
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
