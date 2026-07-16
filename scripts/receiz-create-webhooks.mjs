#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  RECEIZ_WEBHOOK_EVENT_TYPES,
  createReceizClient
} from "@receiz/sdk";

const dryRun = process.argv.slice(2).includes("--dry-run");
const credentialsDirectory = resolve(process.cwd(), "tmp");
const credentialsPath = resolve(credentialsDirectory, "receiz-webhook-credentials.json");

function safeHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function output(report, status = 0) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (status !== 0) process.exitCode = status;
}

const baseUrl = safeHttpsUrl(process.env.RECEIZ_BASE_URL);
const webhookUrl = safeHttpsUrl(process.env.RECEIZ_WEBHOOK_URL);
const accessToken = process.env.RECEIZ_ACCESS_TOKEN?.trim() ?? "";
const requestedEventTypes = [...new Set(
  (process.env.RECEIZ_WEBHOOK_EVENT_TYPES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
)];
const supportedEventTypes = new Set(RECEIZ_WEBHOOK_EVENT_TYPES);
const eventTypesValid = requestedEventTypes.length > 0
  && requestedEventTypes.every((value) => supportedEventTypes.has(value));
const missingEnvironment = [
  ...(!baseUrl ? ["RECEIZ_BASE_URL"] : []),
  ...(!accessToken ? ["RECEIZ_ACCESS_TOKEN"] : []),
  ...(!webhookUrl ? ["RECEIZ_WEBHOOK_URL"] : []),
  ...(!eventTypesValid ? ["RECEIZ_WEBHOOK_EVENT_TYPES"] : [])
];

if (missingEnvironment.length > 0) {
  output({ ok: false, action: "configuration-required", missingEnvironment }, 1);
} else if (dryRun) {
  output({ ok: true, action: "dry-run", eventCount: requestedEventTypes.length });
} else {
  const client = createReceizClient({ baseUrl, accessToken });
  try {
    const listed = await client.webhookEndpoints.list();
    const existing = listed.endpoints.find((endpoint) => endpoint.url === webhookUrl);
    if (existing) {
      const existingEvents = [...existing.eventTypes].sort();
      const requestedEvents = [...requestedEventTypes].sort();
      if (JSON.stringify(existingEvents) === JSON.stringify(requestedEvents)) {
        output({ ok: true, action: "already-configured", eventCount: requestedEventTypes.length });
      } else {
        output({ ok: false, action: "existing-endpoint-conflict", eventCount: requestedEventTypes.length }, 1);
      }
    } else if (existsSync(credentialsPath)) {
      output({ ok: false, action: "credential-file-exists" }, 1);
    } else {
      const idempotencyKey = `wildz_webhook_${createHash("sha256")
        .update(`${webhookUrl}\n${[...requestedEventTypes].sort().join("\n")}`)
        .digest("hex")
        .slice(0, 32)}`;
      const created = await client.webhookEndpoints.create({
        label: "Wildz production",
        url: webhookUrl,
        eventTypes: requestedEventTypes,
        idempotencyKey
      });
      const secret = created.credentials?.secret;
      if (!created.ok || typeof secret !== "string" || !secret) {
        output({ ok: false, action: "credential-response-invalid" }, 1);
      } else {
        try {
          await mkdir(credentialsDirectory, { recursive: true, mode: 0o700 });
          await writeFile(credentialsPath, JSON.stringify({
            endpointId: created.credentials.endpointId,
            secret
          }, null, 2), { encoding: "utf8", flag: "wx", mode: 0o600 });
          output({
            ok: true,
            action: "created",
            eventCount: requestedEventTypes.length,
            credentialFile: "tmp/receiz-webhook-credentials.json"
          });
        } catch {
          output({ ok: false, action: "credential-persistence-failed" }, 1);
        }
      }
    }
  } catch {
    output({ ok: false, action: "receiz-request-failed" }, 1);
  }
}
