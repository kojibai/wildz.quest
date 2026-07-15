# Wildz V3 Production Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qualify and release Wildz V3.0.0 as a secure, accessible, bounded, installable standalone PWA whose offline and Receiz claims are proven by automated gates and fresh production-browser evidence.

**Architecture:** Keep the completed identity, continuity, public-economy, V3 kernel, world, and player-experience boundaries intact. Add a deny-by-default service-worker policy, bounded server artifact proxy, shared dialog lifecycle, explicit renderer/recovery boundaries, and deterministic release scripts around those finished features. Release evidence comes from a production build, live read-only Receiz diagnostics, source-compatible artifact readers, and isolated WebKit and Chromium sessions; documentation records only checks that actually ran.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.6, Three.js 0.182, React Three Fiber 9.6, Drei 10.7, `@receiz/sdk` 100.0.0, Node test runner, Web App Manifest, service worker, Web Crypto, IndexedDB, Playwright CLI with WebKit and Chromium.

## Global Constraints

- Complete the identity-authority, kernel-continuity, public-economy, and player-experience plans before this plan.
- Work on `main`, use path-specific staging, commit each implementation task, and do not push.
- Preserve the accepted standalone presentation. Make surgical changes; do not replace `PlayCampaign.tsx`, `WildsCommandDock.tsx`, `WildsWorldCanvas.tsx`, `WildzApp.tsx`, or `app/globals.css` wholesale.
- Feature completeness remains pinned to upstream `v3.0.0` commit `1cf84c0154b8cba45b0c0730dc0752235f758be8`, with audited fixes only through `a9b0f0eaef4af894efd052e40f09299244c4ffd4`.
- Use installed `@receiz/sdk` 100.0.0 for identity, artifact, proof, session, publication, and capability decisions. Do not emulate a successful live rail.
- Receiz MCP and AI skills are operator documentation only. They never outrank verified proof and may not be described as executed unless release evidence proves execution.
- Keep the customer-facing product `Wildz` at `wildz.quest`; do not add storefront, cart, merchant administration, or commerce navigation.
- A verified identity-bearing Vault activates its embedded identity and V3 continuity; an Identity Seal activates its embedded identity; a card-only Vault never invents identity authority.
- Plaintext key files, raw private material, credentials, historical private artifact bytes, private usernames, and private card IDs are forbidden in repository files, logs, screenshots, console output, release JSON, prompts, and MCP output.
- New saves remain identity-scoped. A failed import, remote outage, or browser rehearsal must preserve the previously committed owner state atomically.
- The existing Safari-safe bound `window.fetch` adapter remains covered by regression tests.
- Preserve the six-slot dock and complete ordered card surfaces established by the player-experience plan.
- Remote authority fails closed when credentials or required capabilities are unavailable. Browser qualification performs no listing, offer, transfer, purchase, settlement, publication, credential rotation, or other live mutation.
- No new npm runtime dependency is required.
- Service-worker domain caching is allowlisted: visited public card/profile documents and successful GET card API responses only. Authentication, world, market, Receiz, artifact proxy, mutation, personalized, and failed responses are never cached. A credential-free versioned `/` document, `/offline`, and same-origin immutable build/icon assets form the separate app-shell cache so an installed app can start owner-scoped verified IndexedDB state offline.
- Installing and applying an update are separate explicit user actions. The worker never invokes `skipWaiting()` during `install`; an update invokes it only after the user chooses Apply Update. Activated workers call `clients.claim()`.
- The offline page must name the real boundary: cached public pages/cards may remain readable; sign-in, live world, social, market, publication, trade, and other mutations require a connection.
- Production detailed rendering is capped at two ecology presences, one boss, and two support avatars while full canonical state remains available to selectors and non-Three.js surfaces.
- Production diagnostics are absent unless `NEXT_PUBLIC_WILDZ_DIAGNOSTICS=1`; diagnostics never run a 500 ms interval in any build.
- Every modal dialog traps focus, closes on Escape where dismissal is permitted, and restores the exact trigger. Every visible Wildz touch target is at least 44 by 44 CSS pixels, keyboard terrain scan is reachable, and browser zoom remains enabled.
- Artifact proxies enforce method, MIME, request bytes, response bytes, fixed upstream path, HTTPS policy, timeout, safe response headers, `no-store`, and generic errors. Do not add process-memory rate limiting and claim it is a durable deployment control.
- Sanitized interoperability fixtures must come from the named official/source-compatible writers. Provenance is supplied by those writers and validated; it is never inferred from a filename.
- The historical private Vault stays outside the repository and is never recorded. Its WebKit and Chromium gates compare the exact embedded username and sorted verified card-ID set in memory, both immediately and after a cold relaunch.
- Duplicate occurrences of the identical asset ID may collapse deterministically. Dropping any unique verified card ID, admitting an extra ID, or falling back to the prior/current username blocks release.
- Use Playwright CLI through `/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh`; take a fresh snapshot before interaction and use semantic locators in `run-code` when element references are session-specific.
- Qualify both WebKit and Chromium at 320x568, 390x844, 430x932, and desktop 1440x900. Measure first contentful paint and initially loaded JavaScript bytes in every fresh session, and collect renderer diagnostics in both desktop engines.
- Final version and evidence remain uncommitted until every local, strict-live, interoperability, private-Vault, offline/update, accessibility, market, WebGL, and browser matrix gate passes.
- The final commit is `release: Wildz v3.0.0`. Push remains the user's action.

## File Structure

- `app/offline/page.tsx` — truthful offline boundary.
- `public/sw.js` — deny-by-default shell/public-document/card-GET worker.
- `src/features/pwa/pwa-events.ts` — install/update browser event contract.
- `src/lib/receiz/artifact-proxy.ts` — bounded verify/seal proxy shared by both routes.
- `src/features/shell/WildzDialogSurface.tsx` — one modal surface using the existing `useWildzDialog` lifecycle.
- `src/features/play/wilds-render-budget.ts` — detailed ecology/boss/support caps.
- `src/features/play/wilds-diagnostics.ts` — production opt-in and event-driven sampling.
- `src/features/play/wilds-webgl-recovery.ts` — context loss/restoration listener boundary.
- `src/lib/release/wildz-release-evidence.ts` — exact sorted-ID comparison and writer vocabulary.
- `scripts/release-check.mjs` — deterministic local and strict-live release orchestration.
- `scripts/validate-release-artifact-matrix.mjs` — non-private writer-provenance manifest gate.
- `output/playwright/v3-release/` — sanitized screenshots and browser result summaries.

## Common Focused Test Loop

Every implementation task begins with its named red test, compiles and runs that test, implements the smallest complete behavior, repeats the focused test, runs the preserved adjacent tests, and commits only that task's paths. A compile failure is acceptable only when the task explicitly expects a missing module. Final qualification uses the completed production build, not `next dev`.

---

### Task 0: Verify the Completed V3 Dependency Checkpoint

**Files:**
- Verify only: source and tests produced by the four preceding V3 plans
- Verify only: `docs/superpowers/specs/2026-07-15-wildz-v3-production-continuity-design.md`

**Interfaces:**
- Consumes: finished `WildzIdentitySession`, `WildzArtifactInspection`, owner-scoped V8/V3 continuity, durable public/economy repositories, canonical world client, complete player experience, shared card ordering, Trail Pack, and `useWildzDialog`.
- Produces: a clean, green production-release starting point without reimplementing earlier behavior.

- [ ] **Step 1: Confirm branch, ancestry, and clean task boundary**

```bash
git branch --show-current
git merge-base --is-ancestor d1ac904 HEAD
git status --short
```

Expected: branch is `main`; ancestry exits 0; only plan-document changes from the planning pass may be present.

- [ ] **Step 2: Confirm the dependency interfaces exist**

```bash
test -f src/lib/receiz/wildz-identity-repository.ts
test -f src/lib/receiz/wildz-artifact-codec.ts
test -f src/lib/receiz/wildz-continuity-coordinator.ts
test -f src/lib/receiz/wilds-world-repository.ts
test -f src/lib/receiz/wildz-public-repository.ts
test -f src/lib/receiz/wildz-market-repository.ts
test -f src/features/play/wilds-player-vault.ts
test -f src/features/play/use-wilds-world.ts
test -f src/features/play/wilds-card-order.ts
test -f src/features/play/wilds-trail-pack.ts
test -f src/features/shell/use-wildz-dialog.ts
```

Expected: every command exits 0. If any file is absent, finish its owning plan before continuing.

- [ ] **Step 3: Run the inherited baseline**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm secret:scan
pnpm build
pnpm receiz:doctor
node scripts/next-runtime-guard.mjs assert-idle
```

Expected: tests, typecheck, lint, secret scan, build, and idle guard pass. The default doctor exits 0 and truthfully reports unconfigured remote rails as `needs-env`; it is not the strict-live release gate.

- [ ] **Step 4: Confirm Task 0 was read-only**

```bash
git status --short
```

Expected: no source, test, runtime, or evidence file changed. Task 0 creates no commit.

---

### Task 1: Make Offline, Install, and Update Behavior Truthful

**Files:**
- Create: `app/offline/page.tsx`
- Create: `src/features/pwa/pwa-events.ts`
- Modify: `src/features/pwa/PwaController.tsx`
- Modify: `public/sw.js`
- Modify: `app/layout.tsx`
- Verify: `app/manifest.ts`
- Verify: `public/icons/icon-180.png`
- Create: `tests/pwa-cache-policy.test.ts`
- Modify: `tests/pwa.test.ts`
- Modify: `tests/pwa-runtime.test.ts`

**Interfaces:**
- Produces: `WILDZ_APPLY_UPDATE_MESSAGE`, `BeforeInstallPromptEvent`, a visible consent-driven install action, a visible waiting-worker action, and `classifyWildzRequest` with results `shell`, `public-document`, `card-get`, or `network-only`.
- Consumes: completed owner-scoped continuity so `wildz:preserve-state` can finish before the waiting worker is activated.

- [ ] **Step 1: Write the failing policy and consent contracts**

Create `tests/pwa-cache-policy.test.ts` with self-contained source assertions:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the worker caches only shell assets, public documents, and GET card data", () => {
  const worker = readFileSync("public/sw.js", "utf8");
  assert.match(worker, /function classifyWildzRequest/);
  assert.match(worker, /\/api\/cards\//);
  assert.match(worker, /\/cards\//);
  assert.match(worker, /\/u\//);
  for (const forbidden of ["/api/auth", "/api/wilds", "/api/market", "/api/receiz", "/api/document-verify"]) {
    assert.match(worker, new RegExp(forbidden.replaceAll("/", "\\/")));
  }
  assert.match(worker, /request\.method !== "GET"/);
  assert.match(worker, /SHELL_URLS = \["\/", "\/offline"/);
  assert.match(worker, /\/offline/);
  assert.match(worker, /clients\.claim\(\)/);
});

test("install does not skip waiting and update waits for a user message", () => {
  const worker = readFileSync("public/sw.js", "utf8");
  const installBody = worker.slice(worker.indexOf('addEventListener("install"'), worker.indexOf('addEventListener("activate"'));
  assert.doesNotMatch(installBody, /skipWaiting/);
  assert.match(worker, /WILDZ_APPLY_UPDATE/);
  assert.match(worker, /self\.skipWaiting\(\)/);

  const controller = readFileSync("src/features/pwa/PwaController.tsx", "utf8");
  assert.match(controller, /beforeinstallprompt/);
  assert.match(controller, /Install Wildz/);
  assert.match(controller, /Apply update/);
  assert.match(controller, /wildz:preserve-state/);
  assert.doesNotMatch(controller, /location\.reload/);
});

test("the Apple icon is PNG and user zoom stays enabled", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /apple:\s*"\/icons\/icon-180\.png"/);
  assert.doesNotMatch(layout, /maximumScale/);
  assert.match(layout, /userScalable:\s*true/);
});
```

- [ ] **Step 2: Run the red focused compile/test**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/pwa-cache-policy.test.js .test-build/tests/pwa.test.js .test-build/tests/pwa-runtime.test.js
```

Expected: the new tests fail because the current worker caches navigation broadly, install consent is absent, `clients.claim()` is absent, the Apple icon is SVG, and zoom is capped.

- [ ] **Step 3: Implement the exact worker classification boundary**

Keep the policy in `public/sw.js` inspectable and deterministic:

```js
const WILDZ_APPLY_UPDATE_MESSAGE = "WILDZ_APPLY_UPDATE";
const release = new URL(self.location.href).searchParams.get("release") || "v3.0.0";
const SHELL_CACHE = `wildz-shell-${release}`;
const PUBLIC_CACHE = `wildz-public-${release}`;
const SHELL_URLS = ["/", "/offline", "/brand/wildz-mark.svg", "/brand/wildz-wordmark.svg", "/icons/icon-180.png", "/icons/icon-192.png", "/icons/icon-512.png"];
const PUBLIC_DOCUMENT = /^\/(?:cards\/[^/]+|u\/[^/]+)\/?$/;
const CARD_GET = /^\/api\/cards\/[^/]+(?:\/image)?\/?$/;
const NETWORK_ONLY_PREFIXES = ["/api/auth", "/api/wilds", "/api/market", "/api/receiz", "/api/document-verify"];

function classifyWildzRequest(request, url = new URL(request.url)) {
  if (request.method !== "GET" || url.origin !== self.location.origin) return "network-only";
  if (request.headers.has("authorization") || NETWORK_ONLY_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return "network-only";
  if (SHELL_URLS.includes(url.pathname) || url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/")) return "shell";
  if (request.mode === "navigate" && PUBLIC_DOCUMENT.test(url.pathname)) return "public-document";
  if (CARD_GET.test(url.pathname)) return "card-get";
  return "network-only";
}
```

The event handlers must implement these exact semantics:

- `install` pre-caches only `SHELL_URLS` and never calls `skipWaiting()`. Fetch `/` as a credential-free `Request` and admit only a successful `text/html` shell with no `Set-Cookie`; it contains no identity/card/world data because verified owner state restores from IndexedDB;
- `activate` deletes older `wildz-shell-*` and `wildz-public-*` caches, then awaits `self.clients.claim()`;
- `message` calls `self.skipWaiting()` only when `event.data?.type === WILDZ_APPLY_UPDATE_MESSAGE`;
- `shell` is cache-first and stores only the versioned credential-free root document plus same-origin successful immutable assets. Offline `/` returns that root shell so local verified continuity can start; it is never used as a fallback for another URL;
- `public-document` is network-first, stores only successful `text/html` responses without `Cache-Control: no-store`, and falls back to the exact visited response or cached `/offline`, never cached `/`;
- `card-get` is network-first, stores only successful `application/json` or `image/*` responses without `Cache-Control: no-store`, and falls back only to the exact cached GET;
- `network-only` calls `fetch(request)` without opening a cache; a failed navigation returns `/offline`, while a failed API request remains a network failure;
- non-2xx responses, opaque responses, redirects, `Vary: *`, and requests carrying `Authorization` are never written.

Expose `classifyWildzRequest` only under the Node test guard:

```js
if (typeof module !== "undefined") module.exports = { classifyWildzRequest };
```

- [ ] **Step 4: Add explicit install and update consent**

Define the browser event in `src/features/pwa/pwa-events.ts`:

```ts
export const WILDZ_APPLY_UPDATE_MESSAGE = "WILDZ_APPLY_UPDATE";

export type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};
```

In `PwaController`, register `/sw.js?release=${encodeURIComponent(process.env.NEXT_PUBLIC_WILDZ_SW_RELEASE ?? "v3.0.0")}` after the current idle boundary. Capture `beforeinstallprompt`, call `preventDefault()`, and render `Install Wildz` only while a captured prompt exists. Call `prompt()` only from that button and clear the captured event after `userChoice` settles. When `registration.waiting` or `updatefound` reaches `installed` under an existing controller, render `Apply update`; do not post a message until the button is clicked. The click must dispatch `wildz:preserve-state`, wait one animation frame so owner-state listeners flush, post `{ type: WILDZ_APPLY_UPDATE_MESSAGE }`, and show an `aria-live="polite"` applied status on `controllerchange` without forcing reload.

- [ ] **Step 5: Add the truthful offline page, PNG Apple icon, and zoomable viewport**

`app/offline/page.tsx` must state that previously visited public profiles, public cards, and cached card details can remain readable. It must state that sign-in, live world, social presence, market, publishing, listing, trade, transfer, and payment require a connection. It must not claim the live game or mutations work offline.

In `app/layout.tsx`, set the Apple icon to `/icons/icon-180.png`, remove `maximumScale`, and set `userScalable: true`. Keep `viewportFit: "cover"`. Do not change the manifest's existing 192, 512, and maskable PNG declarations.

- [ ] **Step 6: Run focused and adjacent green gates**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/pwa-cache-policy.test.js .test-build/tests/pwa.test.js .test-build/tests/pwa-runtime.test.js .test-build/tests/wildz-continuity-and-shell.test.js
file public/icons/icon-180.png
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all tests and static gates pass; `file` reports PNG image data; the worker has no install-time `skipWaiting`; `/offline` builds; zoom is enabled.

- [ ] **Step 7: Commit**

```bash
git add app/offline/page.tsx src/features/pwa/pwa-events.ts src/features/pwa/PwaController.tsx public/sw.js app/layout.tsx tests/pwa-cache-policy.test.ts tests/pwa.test.ts tests/pwa-runtime.test.ts
git commit -m "feat: make Wildz PWA cache and updates truthful"
```

---

### Task 2: Add Security Headers and Bounded Artifact Proxies

**Files:**
- Modify: `next.config.mjs`
- Create: `src/lib/receiz/artifact-proxy.ts`
- Modify: `app/api/document-verify/route.ts`
- Modify: `app/api/receiz/seal/route.ts`
- Create: `tests/security-headers.test.ts`
- Create: `tests/artifact-proxy.test.ts`

**Interfaces:**
- Produces: `RECEIZ_ARTIFACT_PROXY_MAX_REQUEST_BYTES`, `RECEIZ_ARTIFACT_PROXY_MAX_RESPONSE_BYTES`, `RECEIZ_ARTIFACT_PROXY_TIMEOUT_MS`, `ReceizArtifactProxyKind`, `ReceizArtifactSignature`, `detectReceizArtifactSignature`, `readBoundedArtifactBody`, `resolveReceizArtifactEndpoint`, and `proxyReceizArtifact`.
- Consumes: `RECEIZ_BASE_URL`; fixed upstream paths `/api/document-verify` and `/api/document-seal`.

- [ ] **Step 1: Write failing header and proxy tests**

Create `tests/security-headers.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("production responses declare the security policy", () => {
  const config = readFileSync("next.config.mjs", "utf8");
  for (const header of [
    "Content-Security-Policy",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "X-Frame-Options",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy"
  ]) assert.match(config, new RegExp(header));
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(config, /object-src 'none'/);
});
```

Create the first bounded-body cases in `tests/artifact-proxy.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RECEIZ_ARTIFACT_PROXY_MAX_REQUEST_BYTES,
  detectReceizArtifactSignature,
  readBoundedArtifactBody,
  resolveReceizArtifactEndpoint
} from "../src/lib/receiz/artifact-proxy";

function byteStream(length: number) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(length));
      controller.close();
    }
  });
}

test("bounded artifact reads reject the first byte over the limit", async () => {
  await assert.rejects(
    readBoundedArtifactBody(byteStream(RECEIZ_ARTIFACT_PROXY_MAX_REQUEST_BYTES + 1), RECEIZ_ARTIFACT_PROXY_MAX_REQUEST_BYTES),
    /receiz_artifact_body_too_large/
  );
});

test("upstream endpoints are fixed and production requires HTTPS", () => {
  assert.equal(resolveReceizArtifactEndpoint("verify", "https://receiz.example").pathname, "/api/document-verify");
  assert.equal(resolveReceizArtifactEndpoint("seal", "https://receiz.example/ignored").pathname, "/api/document-seal");
  assert.throws(() => resolveReceizArtifactEndpoint("verify", "http://remote.example"), /receiz_artifact_base_url_insecure/);
});

test("artifact signatures are content-derived", () => {
  assert.equal(detectReceizArtifactSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.equal(detectReceizArtifactSignature(new TextEncoder().encode("not-an-artifact")), null);
});
```

Extend that file with mocked-fetch cases for request `Content-Length` over limit, wrong MIME, upstream timeout, upstream response `Content-Length` over limit, streamed response over limit, safe response-header allowlisting, and `Cache-Control: no-store`. Restore `globalThis.fetch` and every changed environment variable in `test.afterEach`.

- [ ] **Step 2: Run the red compile**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: TypeScript reports `TS2307` for `src/lib/receiz/artifact-proxy.ts`.

- [ ] **Step 3: Implement the bounded proxy boundary**

Create these exact exports in `src/lib/receiz/artifact-proxy.ts`:

```ts
export const RECEIZ_ARTIFACT_PROXY_MAX_REQUEST_BYTES = 12 * 1024 * 1024;
export const RECEIZ_ARTIFACT_PROXY_MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
export const RECEIZ_ARTIFACT_PROXY_TIMEOUT_MS = 15_000;

export type ReceizArtifactProxyKind = "verify" | "seal";
export type ReceizArtifactSignature = "png" | "jpeg" | "pdf" | "zip" | "json";

export function detectReceizArtifactSignature(bytes: Uint8Array): ReceizArtifactSignature | null;

export async function readBoundedArtifactBody(
  stream: ReadableStream<Uint8Array> | null,
  limit: number
): Promise<Uint8Array>;

export function resolveReceizArtifactEndpoint(
  kind: ReceizArtifactProxyKind,
  baseUrl: string = process.env.RECEIZ_BASE_URL ?? "https://receiz.com"
): URL;

export async function proxyReceizArtifact(
  request: Request,
  kind: ReceizArtifactProxyKind
): Promise<Response>;
```

`readBoundedArtifactBody` must use `stream.getReader()`, sum bytes before concatenation, cancel the reader on overflow, and throw `Error("receiz_artifact_body_too_large")`. `resolveReceizArtifactEndpoint` must parse a URL, reject credentials and fragments, accept HTTPS, accept `http://127.0.0.1` or `http://localhost` only outside production, clear query/hash, and replace the pathname with the fixed endpoint.

`detectReceizArtifactSignature` must recognize PNG, JPEG, PDF, ZIP, and JSON from bounded leading bytes and return `null` for an unknown signature. `proxyReceizArtifact` must:

- require `POST` and `multipart/form-data`;
- reject a declared request length over 12 MiB before reading;
- read and bound the request stream before any upstream call;
- parse the already-bounded multipart body through a new `Request`, require exactly one nonempty `file` Blob, require its declared MIME to agree with a recognized signature, and reject an unknown or mismatched signature with 415;
- use an `AbortController` with the 15-second timeout and clear the timer in `finally`;
- call the fixed URL with only method, bounded body, original multipart `content-type`, `cache: "no-store"`, `redirect: "error"`, and the abort signal;
- reject an upstream declared or streamed response over 16 MiB;
- require JSON for verify responses and PNG/JPEG/PDF/ZIP/JSON for seal responses, rejecting an unexpected upstream MIME as 502;
- forward only `content-type`, `content-disposition`, `x-receiz-verify-path`, and `x-receiz-verify-url`;
- always add `cache-control: no-store` and `x-content-type-options: nosniff`;
- return typed JSON errors with status 405, 413, 415, 502, or 504 and codes only; never include upstream bodies, URLs, headers, credentials, or raw exception messages.

Use one-line route delegation while retaining `runtime = "nodejs"`:

```ts
import { proxyReceizArtifact } from "@/lib/receiz/artifact-proxy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return proxyReceizArtifact(request, "verify");
}
```

The seal route is identical except for `"seal"`.

- [ ] **Step 4: Add compatible response security headers**

Keep the existing `/sw.js` and manifest cache rules and add a `/:path*` rule with:

```text
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' blob:
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```

Do not add `Cross-Origin-Embedder-Policy`; current card imagery and Receiz flows are not yet proven COEP-compatible. Preserve external top-level OIDC/payment navigation while blocking framing and object embedding.

- [ ] **Step 5: Run focused, route, and build gates**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/security-headers.test.js .test-build/tests/artifact-proxy.test.js .test-build/tests/wildz-market-routes.test.js .test-build/tests/wildz-restore.test.js
pnpm typecheck
pnpm lint
pnpm build
pnpm secret:scan
```

Expected: all commands pass; overflow and timeout cases return bounded generic errors; routes no longer call `arrayBuffer()` directly; the production build emits the intended headers.

- [ ] **Step 6: Commit**

```bash
git add next.config.mjs src/lib/receiz/artifact-proxy.ts app/api/document-verify/route.ts app/api/receiz/seal/route.ts tests/security-headers.test.ts tests/artifact-proxy.test.ts
git commit -m "fix: harden production responses and artifact proxies"
```

---

### Task 3: Close Modal, Keyboard, Zoom, and Touch Accessibility Gaps

**Files:**
- Modify: `src/features/shell/use-wildz-dialog.ts`
- Create: `src/features/shell/WildzDialogSurface.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsCommandDock.tsx`
- Modify: `src/features/play/WildsWorldMap.tsx`
- Modify: `src/features/play/WildsCaptureReward.tsx`
- Modify: `src/features/play/WildsChildCeremony.tsx`
- Modify: `src/features/play/WildsTransformation.tsx`
- Modify: `src/features/play/WildsMultiplayer.tsx`
- Modify: `src/features/play/WildsLandmarkExperience.tsx`
- Modify: `src/features/play/WildsV3ActivitySheet.tsx`
- Modify: `src/features/play/WildsTrailPackSheet.tsx`
- Verify: `src/features/play/WildzSocialDeck.tsx`
- Verify: `src/features/play/WildsInventory.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `tests/wildz-production-accessibility.test.ts`
- Modify: `tests/wildz-accessibility.test.ts`

**Interfaces:**
- Produces: `nextWildzDialogFocusIndex`, `WildzDialogSurface`, stable QA attributes `data-wildz-active-username`, `data-wildz-card-id`, `data-wildz-artifact-input`, `data-wildz-restore-status`, and `data-wildz-scan-status`.
- Consumes: the player-experience plan's `useWildzDialog`, existing `e` terrain scan, overlay callbacks, and owner-scoped restore flow.

- [ ] **Step 1: Write failing pure and source contracts**

Create `tests/wildz-production-accessibility.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { nextWildzDialogFocusIndex } from "../src/features/shell/use-wildz-dialog";

test("dialog focus wraps in both directions", () => {
  assert.equal(nextWildzDialogFocusIndex(2, 3, false), 0);
  assert.equal(nextWildzDialogFocusIndex(0, 3, true), 2);
  assert.equal(nextWildzDialogFocusIndex(0, 0, false), -1);
});

test("every modal source uses the shared focus lifecycle", () => {
  const files = [
    "src/features/shell/WildzApp.tsx",
    "src/features/play/PlayCampaign.tsx",
    "src/features/play/WildsCommandDock.tsx",
    "src/features/play/WildsWorldMap.tsx",
    "src/features/play/WildsCaptureReward.tsx",
    "src/features/play/WildsChildCeremony.tsx",
    "src/features/play/WildsTransformation.tsx",
    "src/features/play/WildsMultiplayer.tsx",
    "src/features/play/WildsLandmarkExperience.tsx",
    "src/features/play/WildsV3ActivitySheet.tsx",
    "src/features/play/WildsTrailPackSheet.tsx"
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (/role=["{']dialog/.test(source)) assert.match(source, /WildzDialogSurface|useWildzDialog/, file);
  }
  for (const file of ["src/features/play/WildsV3ActivitySheet.tsx", "src/features/play/WildsTrailPackSheet.tsx"]) {
    assert.match(readFileSync(file, "utf8"), /WildzDialogSurface/, file);
  }
});

test("release-visible identity, cards, import, restore, and scan have stable semantic hooks", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const cards = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8") + readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  assert.match(shell + campaign, /data-wildz-active-username/);
  assert.match(cards, /data-wildz-card-id/);
  assert.match(shell + campaign, /data-wildz-artifact-input/);
  assert.match(shell + campaign, /data-wildz-restore-status/);
  assert.match(campaign, /data-wildz-scan-status/);
  assert.match(campaign, /key === "e"/);
});

test("Wildz interaction targets use the 44-pixel token and zoom is enabled", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(css, /--wildz-tap-target:\s*44px/);
  assert.match(css, /min-block-size:\s*var\(--wildz-tap-target\)/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(layout, /maximumScale/);
});
```

- [ ] **Step 2: Run the red focused test**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: compile fails because `nextWildzDialogFocusIndex` and `WildzDialogSurface` are missing, or focused assertions fail on modal surfaces without the shared lifecycle.

- [ ] **Step 3: Complete the shared dialog lifecycle**

Add this pure export to `use-wildz-dialog.ts` and use it inside the hook's Tab handler:

```ts
export function nextWildzDialogFocusIndex(currentIndex: number, count: number, backward: boolean) {
  if (count <= 0) return -1;
  const direction = backward ? -1 : 1;
  return (currentIndex + direction + count) % count;
}
```

The hook must capture `document.activeElement` exactly once when opening, select enabled visible tabbables on each keydown, focus the surface itself when none exist, wrap Tab/Shift+Tab, call `onDismiss` on Escape, and restore `restoreFocusTo` or the captured connected element on close/unmount. It must remove listeners and never restore focus into an inert subtree.

Create `WildzDialogSurface.tsx` as a `forwardRef` section with this public contract:

```ts
export type WildzDialogSurfaceProps = Omit<React.ComponentPropsWithoutRef<"section">, "role"> & {
  onDismiss: () => void;
  restoreFocusTo?: HTMLElement | null;
};

export const WildzDialogSurface = React.forwardRef<HTMLElement, WildzDialogSurfaceProps>(
  function WildzDialogSurface({ onDismiss, restoreFocusTo, tabIndex = -1, ...props }, forwardedRef) {
    const localRef = React.useRef<HTMLElement | null>(null);
    React.useImperativeHandle(forwardedRef, () => localRef.current as HTMLElement);
    useWildzDialog({ open: true, dialogRef: localRef, onDismiss, restoreFocusTo });
    return <section {...props} aria-modal="true" ref={localRef} role="dialog" tabIndex={tabIndex} />;
  }
);
```

Replace each mounted modal's raw dialog element with `WildzDialogSurface`. The V3 activity and Trail Pack sheets are modal game sheets and must use the same surface even if their current root uses sheet terminology rather than `role="dialog"`. Pass each component's real close/cancel callback; do not add dismissal to non-cancellable transformation/ceremony moments until their existing completion action permits it. In those non-cancellable moments, pass an `onDismiss` that focuses the current primary action without mutating game state. Keep the world sibling inert only while a modal is open, never an ancestor containing the dialog.

- [ ] **Step 4: Preserve keyboard scan and add semantic release hooks**

Retain the editable-target guard before handling game keys. Lowercase the event key once and let `e` invoke the existing camera-relative terrain scan with `preventDefault()`. The visible scan control remains a native button, so Enter and Space work without custom handlers. Add an `aria-live="polite"` element with `data-wildz-scan-status` whose text changes after a scan.

Add these attributes to existing visible values without creating a second state source:

- `data-wildz-active-username={identity.username}` on the rendered active handle;
- `data-wildz-card-id={asset.id}` on every complete card item in both rail and Vault;
- `data-wildz-artifact-input` on the actual file input;
- `data-wildz-restore-status` on the restore live region.

These attributes expose only values already visible in the current UI and exist to make exact release assertions stable.

- [ ] **Step 5: Enforce 44-pixel targets, focus visibility, safe areas, and reduced motion**

Define `--wildz-tap-target: 44px` on the Wildz root. Within the standalone app, apply `min-block-size` and `min-inline-size` using that token to visible `button`, `a[href]`, `select`, non-hidden `input`, `textarea`, and `[role="button"]`. Preserve compact artwork by placing the target size on its interactive wrapper. Add a high-contrast `:focus-visible` outline with nonzero offset, safe-area padding for fixed controls, and a `prefers-reduced-motion: reduce` rule that removes nonessential transitions and continuous decorative motion. Keep `userScalable: true` and no `maximumScale` in `app/layout.tsx`.

- [ ] **Step 6: Run focused and full accessibility gates**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-production-accessibility.test.js .test-build/tests/wildz-accessibility.test.js .test-build/tests/wilds-command-dock.test.js .test-build/tests/wildz-social-deck.test.js .test-build/tests/wilds-card-surfaces.test.js
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands pass; modal focus behavior is shared, scan remains keyboard reachable, stable release hooks reflect existing state, zoom remains enabled, and no target CSS contracts regress.

- [ ] **Step 7: Commit**

```bash
git add src/features/shell/use-wildz-dialog.ts src/features/shell/WildzDialogSurface.tsx src/features/shell/WildzApp.tsx src/features/play/PlayCampaign.tsx src/features/play/WildsCommandDock.tsx src/features/play/WildsWorldMap.tsx src/features/play/WildsCaptureReward.tsx src/features/play/WildsChildCeremony.tsx src/features/play/WildsTransformation.tsx src/features/play/WildsMultiplayer.tsx src/features/play/WildsLandmarkExperience.tsx src/features/play/WildsV3ActivitySheet.tsx src/features/play/WildsTrailPackSheet.tsx app/globals.css app/layout.tsx tests/wildz-production-accessibility.test.ts tests/wildz-accessibility.test.ts
git commit -m "fix: close Wildz keyboard and dialog accessibility gaps"
```

---

### Task 4: Bound Detailed Rendering, Remove Polling Diagnostics, and Recover WebGL

**Files:**
- Create: `src/features/play/wilds-render-budget.ts`
- Create: `src/features/play/wilds-diagnostics.ts`
- Create: `src/features/play/wilds-webgl-recovery.ts`
- Modify: `src/features/play/wilds-v3-presentation.ts`
- Modify: `src/features/play/WildsV3WorldLayer.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `app/globals.css`
- Create: `tests/wilds-render-budget.test.ts`
- Create: `tests/wilds-webgl-recovery.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Produces: `WILDS_DETAILED_RENDER_CAPS`, `selectNearestWildsRenderCandidates`, `capWildsSupportRender`, `wildsDiagnosticsEnabled`, `WILDS_DIAGNOSTICS_SAMPLE_EVENT`, `WildsWebGlRecoveryHandlers`, and `attachWildsWebGlRecovery`.
- Consumes: full canonical ecology/boss projection, the two-slot owner-scoped support tuple, existing `rendererBudgetStatus`, and existing `__THREE_GAME_DIAGNOSTICS__` output.

- [ ] **Step 1: Write failing deterministic cap and diagnostics tests**

Create `tests/wilds-render-budget.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  WILDS_DETAILED_RENDER_CAPS,
  capWildsSupportRender,
  selectNearestWildsRenderCandidates
} from "../src/features/play/wilds-render-budget";
import { wildsDiagnosticsEnabled } from "../src/features/play/wilds-diagnostics";

test("detailed render caps are exact and nearest selection is stable", () => {
  assert.deepEqual(WILDS_DETAILED_RENDER_CAPS, { ecology: 2, bosses: 1, supports: 2 });
  const values = [
    { id: "c", position: { x: 4, z: 0 } },
    { id: "b", position: { x: 1, z: 0 } },
    { id: "a", position: { x: -1, z: 0 } }
  ];
  assert.deepEqual(selectNearestWildsRenderCandidates(values, { x: 0, z: 0 }, 2).map(({ id }) => id), ["a", "b"]);
  assert.deepEqual(values.map(({ id }) => id), ["c", "b", "a"]);
  assert.deepEqual(capWildsSupportRender([{ id: "leader" }, { id: "s1" }, { id: "s1" }, { id: "s2" }, { id: "s3" }], "leader").map(({ id }) => id), ["s1", "s2"]);
});

test("production diagnostics require the explicit flag and never poll", () => {
  assert.equal(wildsDiagnosticsEnabled("production", undefined), false);
  assert.equal(wildsDiagnosticsEnabled("production", "1"), true);
  assert.equal(wildsDiagnosticsEnabled("development", undefined), true);
  const canvas = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  assert.doesNotMatch(canvas, /setInterval\([^)]*,\s*500\)/);
  assert.match(canvas, /WILDS_DIAGNOSTICS_SAMPLE_EVENT/);
});
```

- [ ] **Step 2: Write the failing WebGL listener test**

Create `tests/wilds-webgl-recovery.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { attachWildsWebGlRecovery } from "../src/features/play/wilds-webgl-recovery";

test("WebGL loss is prevented, restoration is observed, and cleanup detaches", () => {
  const canvas = new EventTarget() as HTMLCanvasElement;
  const events: string[] = [];
  const detach = attachWildsWebGlRecovery(canvas, {
    onLost: () => events.push("lost"),
    onRestored: () => events.push("restored")
  });
  const lost = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(lost);
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  assert.equal(lost.defaultPrevented, true);
  assert.deepEqual(events, ["lost", "restored"]);
  detach();
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  assert.deepEqual(events, ["lost", "restored"]);
});
```

- [ ] **Step 3: Run the red compile**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: TypeScript reports missing render-budget, diagnostics, and WebGL recovery modules.

- [ ] **Step 4: Implement one detailed-render budget**

Create `wilds-render-budget.ts`:

```ts
export const WILDS_DETAILED_RENDER_CAPS = { ecology: 2, bosses: 1, supports: 2 } as const;

export type WildsRenderCandidate = {
  id: string;
  position: { x: number; z: number };
};

export function selectNearestWildsRenderCandidates<T extends WildsRenderCandidate>(
  values: readonly T[],
  origin: { x: number; z: number },
  limit: number
) {
  return [...values]
    .sort((left, right) => {
      const leftDistance = (left.position.x - origin.x) ** 2 + (left.position.z - origin.z) ** 2;
      const rightDistance = (right.position.x - origin.x) ** 2 + (right.position.z - origin.z) ** 2;
      return leftDistance - rightDistance || left.id.localeCompare(right.id);
    })
    .slice(0, Math.max(0, limit));
}

export function capWildsSupportRender<T extends { id: string }>(values: readonly T[], leaderId: string | null) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (value.id === leaderId || seen.has(value.id)) return false;
    seen.add(value.id);
    return true;
  }).slice(0, WILDS_DETAILED_RENDER_CAPS.supports);
}
```

Make `wilds-v3-presentation.ts` and `WildsV3WorldLayer.tsx` consume the ecology and boss constants rather than literal limits. Make `WildsWorldCanvas.tsx` consume `capWildsSupportRender` before creating support actors. Never truncate canonical arrays in state, repositories, atlas, guide, history, or Trail Pack.

- [ ] **Step 5: Replace polling with opt-in event-driven diagnostics**

Create `wilds-diagnostics.ts`:

```ts
export const WILDS_DIAGNOSTICS_SAMPLE_EVENT = "wildz:sample-diagnostics";

export function wildsDiagnosticsEnabled(nodeEnv: string | undefined, flag: string | undefined) {
  return nodeEnv !== "production" || flag === "1";
}
```

Render `WildsDiagnostics` only when `wildsDiagnosticsEnabled(process.env.NODE_ENV, process.env.NEXT_PUBLIC_WILDZ_DIAGNOSTICS)` is true. In its effect, sample once through `requestAnimationFrame`, listen for `WILDS_DIAGNOSTICS_SAMPLE_EVENT`, and remove the listener/cancel the pending frame on cleanup. Remove every diagnostics interval. Preserve `__THREE_GAME_DIAGNOSTICS__`, the canvas data snapshot, `rendererBudgetStatus`, Three version, draw calls, triangles, GPU memory counts, DPR, and canvas dimensions. Add `detailedRender: { ecology, bosses, supports }` from the already-capped renderer inputs so production evidence can assert the same 2/1/2 boundary without traversing Three internals.

- [ ] **Step 6: Recover a lost WebGL context without losing canonical state**

Create `wilds-webgl-recovery.ts`:

```ts
export type WildsWebGlRecoveryHandlers = {
  onLost(): void;
  onRestored(): void;
};

export function attachWildsWebGlRecovery(canvas: HTMLCanvasElement, handlers: WildsWebGlRecoveryHandlers) {
  const lost = (event: Event) => {
    event.preventDefault();
    handlers.onLost();
  };
  const restored = () => handlers.onRestored();
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  return () => {
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", restored);
  };
}
```

Attach it to `gl.domElement` in the Canvas `onCreated` callback and dispose the prior listener before attaching a new one and on unmount. On loss, keep canonical React/game state mounted, mark `data-wildz-webgl-status="lost"`, and show an accessible status plus a 44-pixel `Retry 3D world` button. On restore or Retry, increment a Canvas-only epoch, re-create renderer resources, and return the status to `ready`. Do not reload the page, recreate repositories, reset identity, or mutate world state.

- [ ] **Step 7: Run focused performance/recovery and full render gates**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-render-budget.test.js .test-build/tests/wilds-webgl-recovery.test.js .test-build/tests/wilds-render-contract.test.js .test-build/tests/wilds-v3-presentation.test.js .test-build/tests/wilds-trail-pack.test.js
pnpm test
pnpm typecheck
pnpm lint
NEXT_PUBLIC_WILDZ_DIAGNOSTICS=0 pnpm build
```

Expected: all commands pass; production source has no 500 ms diagnostics polling; caps are exact; context loss is recoverable; canonical state tests remain unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/features/play/wilds-render-budget.ts src/features/play/wilds-diagnostics.ts src/features/play/wilds-webgl-recovery.ts src/features/play/wilds-v3-presentation.ts src/features/play/WildsV3WorldLayer.tsx src/features/play/WildsWorldCanvas.tsx app/globals.css tests/wilds-render-budget.test.ts tests/wilds-webgl-recovery.test.ts tests/wilds-render-contract.test.ts
git commit -m "perf: bound Wildz rendering and recover WebGL"
```

---

### Task 5: Build Deterministic Release, Strict-Live, and Artifact-Matrix Gates

**Files:**
- Create: `scripts/release-check.mjs`
- Modify: `scripts/receiz-doctor.mjs`
- Create: `scripts/validate-release-artifact-matrix.mjs`
- Create: `src/lib/release/wildz-release-evidence.ts`
- Modify: `package.json`
- Create: `tests/release-scripts.test.ts`
- Create: `tests/wildz-release-evidence.test.ts`
- Create: `tests/wildz-release-export-live.test.ts`

**Interfaces:**
- Produces: `pnpm receiz:doctor:strict`, working `pnpm release:check`, optional `pnpm release:check -- --strict-live`, `WILDZ_INTEROP_WRITERS`, `sortedUniqueWildzAssetIds`, and `compareExactWildzAssetIds`.
- Consumes: SDK `createReceizClient().doctor`, SDK `createReceizClient().identity.readArtifact`, source `splitWildzPngEnvelope`, source `verifyPortableVaultPng`, and the completed V3 player-Vault verifier.

- [ ] **Step 1: Write failing release-script contracts**

Create `tests/release-scripts.test.ts`:

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("release scripts exist and strict live uses the SDK doctor", () => {
  assert.equal(existsSync("scripts/release-check.mjs"), true);
  const doctor = readFileSync("scripts/receiz-doctor.mjs", "utf8");
  assert.match(doctor, /--strict-live/);
  assert.match(doctor, /createReceizClient/);
  assert.match(doctor, /client\.doctor/);
  assert.match(doctor, /RECEIZ_ACCESS_TOKEN/);
  assert.match(doctor, /receizOidcScopesForRails/);
  assert.match(doctor, /"wallet"/);
  assert.doesNotMatch(doctor, /console\.log\([^)]*ACCESS_TOKEN/);
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts["receiz:doctor:strict"], "node scripts/receiz-doctor.mjs --strict-live");
  assert.equal(pkg.scripts["release:check"], "node scripts/release-check.mjs");
});
```

- [ ] **Step 2: Write failing exact-set comparison tests**

Create `tests/wildz-release-evidence.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WILDZ_INTEROP_WRITERS,
  compareExactWildzAssetIds,
  sortedUniqueWildzAssetIds
} from "../src/lib/release/wildz-release-evidence";

test("the release matrix names every required compatible writer", () => {
  assert.deepEqual(WILDZ_INTEROP_WRITERS, [
    "receiz-commerce",
    "receiz-app",
    "receiz-signal",
    "receiz-sealed-card",
    "wildz-original",
    "sdk-compatible"
  ]);
});

test("exact card comparison dedupes identical IDs but rejects every set difference", () => {
  assert.deepEqual(sortedUniqueWildzAssetIds(["b", "a", "a"]), ["a", "b"]);
  assert.deepEqual(compareExactWildzAssetIds(["a", "a", "b"], ["b", "a"]), { ok: true, expected: ["a", "b"], actual: ["a", "b"] });
  assert.equal(compareExactWildzAssetIds(["a", "b"], ["a"]).ok, false);
  assert.equal(compareExactWildzAssetIds(["a"], ["a", "b"]).ok, false);
});
```

- [ ] **Step 3: Run the red compile/test**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: compile fails for the missing release-evidence module and the script existence test is red.

- [ ] **Step 4: Implement strict-live Receiz doctor without leaking configuration values**

Keep default `pnpm receiz:doctor` non-blocking for local development: it prints SDK version and local/remote statuses, marks unavailable live rails `needs-env`, and exits 0. Under `--strict-live`, require these environment names without printing values:

```text
NEXT_PUBLIC_RECEIZ_MODE=live
RECEIZ_BASE_URL=https URL
RECEIZ_CLIENT_ID=non-empty
RECEIZ_CLIENT_SECRET=non-empty
RECEIZ_OAUTH_STATE_SECRET=at least 32 characters
NEXT_PUBLIC_AUTH_MODE=receiz_id
RECEIZ_AUTH_MODE=receiz_id
RECEIZ_ID_CALLBACK_URL=https://wildz.quest/api/auth/receiz/callback
NEXT_PUBLIC_SITE_URL=https://wildz.quest
NEXT_PUBLIC_CHECKOUT_MODE=receiz
RECEIZ_CHECKOUT_MODE=receiz
RECEIZ_ACCESS_TOKEN=explicitly provisioned release credential
```

Construct `createReceizClient({ baseUrl: process.env.RECEIZ_BASE_URL, accessToken: process.env.RECEIZ_ACCESS_TOKEN })`. Derive the release registration scope with `receizOidcScopesForRails("identity", "wallet", "payments", "proofStore", "world", "appState", "publicStore", "portability", "releases")` so the SDK includes the real `receiz:wallet.transfer`, read, record, and world scopes rather than a hand-written subset, then call:

```js
const report = await client.doctor({
  tenantHost: new URL(process.env.NEXT_PUBLIC_SITE_URL).host,
  callbackUrl: process.env.RECEIZ_ID_CALLBACK_URL,
  scopes
});
```

Strict mode passes only when `report.ok` and `identity`, `wallet`, `payments`, `proofStore`, `world`, `portability`, and `releases` all have `available === true`, and the derived scope contains `receiz:wallet.transfer`. Print a sanitized report containing only mode, SDK version, boolean `ok`, required capability names/statuses, missing environment names, and SDK issue codes. Never print tokens, client secrets, state secrets, private artifact data, request headers, full exception messages, or environment values. Capability inspection is read-only and authorizes no live mutation.

- [ ] **Step 5: Implement deterministic release orchestration**

`scripts/release-check.mjs` must use `spawnSync` with inherited stdio and stop on the first nonzero status. Its local sequence is exactly:

```text
node scripts/next-runtime-guard.mjs assert-idle
pnpm test
pnpm typecheck
pnpm lint
pnpm secret:scan
pnpm build
pnpm receiz:doctor
```

When invoked with `--strict-live`, replace the final doctor command with `pnpm receiz:doctor:strict`. Do not invoke `release:check` recursively, start a server, mutate remote state, or continue after failure. Add `"receiz:doctor:strict": "node scripts/receiz-doctor.mjs --strict-live"` to `package.json` and retain `"release:check": "node scripts/release-check.mjs"`.

- [ ] **Step 6: Implement the sanitized writer manifest and exact ID boundary**

Create `src/lib/release/wildz-release-evidence.ts`:

```ts
export const WILDZ_INTEROP_WRITERS = [
  "receiz-commerce",
  "receiz-app",
  "receiz-signal",
  "receiz-sealed-card",
  "wildz-original",
  "sdk-compatible"
] as const;

export function sortedUniqueWildzAssetIds(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function compareExactWildzAssetIds(expectedValues: readonly string[], actualValues: readonly string[]) {
  const expected = sortedUniqueWildzAssetIds(expectedValues);
  const actual = sortedUniqueWildzAssetIds(actualValues);
  return { ok: expected.length === actual.length && expected.every((value, index) => value === actual[index]), expected, actual };
}
```

`scripts/validate-release-artifact-matrix.mjs` must require `WILDZ_INTEROP_MANIFEST`, parse schema `wildz.release.interop.v1`, require exactly one entry for each writer above in the same fixed order, resolve every artifact path relative to the manifest, require regular files, reject `private: true`, require a nonempty source version/commit and SHA-256 supplied by the source writer, recompute the file SHA-256, require an `artifactKind` of `identity-seal`, `identity-player-vault`, `card-vault`, or `portable-domains`, require `embeddedUsername` for either identity-bearing kind, require arrays `verifiedWildzCardIds` and `verifiedUnrelatedDomainIds`, and reject overlap between those arrays. Across the six entries it requires at least one `identity-seal` and one `identity-player-vault` so the matrix exercises both real journeys; `sdk-compatible` must be an `identity-player-vault` with at least six varied cards and remains the final sanitized owner for offline continuity/export evidence. That entry also carries source-writer-computed `expectedCardOrders: { rarity: string[]; newest: string[]; oldest: string[] }`; each array must contain every `verifiedWildzCardIds` value exactly once, no extra value, and at least two serialized orders must differ. Current-Wildz output is qualified separately by the dual-engine export/source-reader gate, so it is not mislabeled as an external input writer.

The manifest also carries one top-level non-private `publicEvidence` object with paths matching `/u/[handle]`, `/cards/[assetId]`, `/api/profiles/[handle]`, and `/api/cards/[assetId]`. The validator requires same-origin relative paths, matching handle/asset identity across each pair, and successful source-writer provenance for the referenced sanitized profile/card. It writes no artifact bytes and prints only writer, artifact kind, sanitized filename, digest, and counts.

The manifest and artifacts may live in `/private/tmp/wildz-v3-artifacts` or another local directory. Commit them only if their official writer marks them non-private and repository secret scan passes. A missing writer, unverifiable provenance, digest mismatch, private marker, or malformed expected ID set blocks release.

- [ ] **Step 7: Add official SDK/source-reader export verification**

Create `tests/wildz-release-export-live.test.ts`. It skips unless `WILDZ_RELEASE_ARTIFACT_GATE=1`; strict invocation requires `WILDZ_RELEASE_EXPORTED_SEAL_WEBKIT`, `WILDZ_RELEASE_EXPORTED_VAULT_WEBKIT`, `WILDZ_RELEASE_EXPORTED_SEAL_CHROMIUM`, `WILDZ_RELEASE_EXPORTED_VAULT_CHROMIUM`, and `WILDZ_RELEASE_EXPORT_EXPECTATION`. The test must:

- read both engine-specific Seal/Vault pairs only from those local paths;
- call `createReceizClient().identity.readArtifact` on all four artifacts and require valid `receiz.key.v1` authority;
- split each Vault at PNG `IEND`, run the source `verifyPortableVaultPng`, run the V3 player-Vault verifier, and require both engine exports successful;
- read the non-private expectation JSON, compare sorted unique card IDs with `compareExactWildzAssetIds`, and reject missing or extra IDs;
- print only engine labels and pass booleans—no key file, owner, username, path, raw bytes, or card ID.

Normal `pnpm test` reports this environment-dependent test as skipped. The final browser task runs it explicitly after saving sanitized downloads.

- [ ] **Step 8: Run focused script and release gates**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/release-scripts.test.js .test-build/tests/wildz-release-evidence.test.js .test-build/tests/wildz-release-export-live.test.js
pnpm receiz:doctor
pnpm release:check
```

Expected: focused tests pass with the live export test skipped; default doctor reports truthfully; the complete local release check exits 0. Do not run strict-live without the authorized environment.

- [ ] **Step 9: Commit**

```bash
git add scripts/release-check.mjs scripts/receiz-doctor.mjs scripts/validate-release-artifact-matrix.mjs src/lib/release/wildz-release-evidence.ts package.json tests/release-scripts.test.ts tests/wildz-release-evidence.test.ts tests/wildz-release-export-live.test.ts
git commit -m "build: add strict Wildz release gates"
```

---

### Task 6: Qualify the Final V3.0.0 Build and Create the Release Commit

**Files:**
- Modify: `package.json`
- Verify unchanged: `pnpm-lock.yaml`
- Modify: `docs/release/feature-parity.md`
- Modify: `docs/release/verification.md`
- Create: `docs/release/v3.0.0.md`
- Create: `docs/release/artifact-interoperability.md`
- Modify: `docs/RECEIZ_RAILS.md`
- Modify: `docs/MCP.md`
- Modify: `ai-skills/README.md`
- Modify: `ai-skills/wildz-builder-skill/SKILL.md`
- Modify: `ai-skills/wildz-market-operator-skill/SKILL.md`
- Modify: `ai-skills/wildz-release-skill/SKILL.md`
- Create: `tests/wildz-release-documentation.test.ts`
- Create: `output/playwright/v3-release/browser-results.json`
- Create: sanitized screenshots under `output/playwright/v3-release/`

**Interfaces:**
- Consumes: the exact final source tree, authorized strict-live environment, six-writer non-private manifest, one historical private Vault plus its local source-reader expectation, one generated Identity Seal/Vault pair from each browser engine, and Playwright CLI.
- Produces: fresh WebKit and Chromium evidence at 320x568, 390x844, 430x932, and 1440x900; initial-JavaScript and first-paint measurements; exact private restore proof; artifact round-trip proof; direct auth/world/card/profile/market API proof; configured/unconfigured market proof; offline/install/update proof; diagnostics/recovery proof in both desktop engines; truthful release docs; version 3.0.0; final release commit.

- [ ] **Step 1: Establish private local inputs without exposing them**

In a private shell session, set these variables. Do not paste their values into chat, commands, docs, screenshots, or repository files:

```bash
test -n "${WILDZ_INTEROP_MANIFEST:-}"
test -n "${WILDZ_PRIVATE_VAULT_PATH:-}"
test -n "${WILDZ_PRIVATE_VAULT_EXPECTATION_PATH:-}"
test -n "${WILDZ_RELEASE_EXPORTED_SEAL_WEBKIT:-}"
test -n "${WILDZ_RELEASE_EXPORTED_VAULT_WEBKIT:-}"
test -n "${WILDZ_RELEASE_EXPORTED_SEAL_CHROMIUM:-}"
test -n "${WILDZ_RELEASE_EXPORTED_VAULT_CHROMIUM:-}"
test -n "${WILDZ_RELEASE_EXPORT_EXPECTATION:-}"
test -f "$WILDZ_INTEROP_MANIFEST"
test -f "$WILDZ_PRIVATE_VAULT_PATH"
test -f "$WILDZ_PRIVATE_VAULT_EXPECTATION_PATH"
```

Expected: every command exits 0. The private expectation file was created locally by the official/source-compatible reader and contains exactly `{ "embeddedUsername": string, "verifiedWildzCardIds": string[] }`. Its card IDs are the complete verified Wildz-domain set in the Vault before UI import. It remains outside the repository with owner-only permissions. The interoperability manifest contains only sanitized non-private artifacts from Receiz Commerce, receiz.app, Signal, sealed-card, original Wildz, and a generic SDK-compatible writer; current Wildz exports are exercised separately in both browsers.

- [ ] **Step 2: Validate sanitized artifact provenance and strict live capability**

```bash
node scripts/validate-release-artifact-matrix.mjs
pnpm receiz:doctor:strict
```

Expected: all six writer entries pass digest/provenance validation; strict doctor reports `ok: true` with every required capability available and prints no credential value. Missing inputs or capabilities block the release.

- [ ] **Step 3: Set version 3.0.0 before producing browser evidence**

Edit `package.json` to `"version": "3.0.0"`, then prove that dependency lock data does not change:

```bash
pnpm install --lockfile-only --offline
node -e "const p=require('./package.json'); if(p.version!=='3.0.0') process.exit(1)"
git diff --exit-code -- pnpm-lock.yaml
git diff -- package.json
```

Expected: package version reports 3.0.0; `pnpm-lock.yaml` remains byte-for-byte unchanged because pnpm lockfile v9 does not record the root package version and no dependency changed. Keep the package edit uncommitted through every remaining gate.

- [ ] **Step 4: Run the complete final local and strict-live gates**

```bash
pnpm release:check
pnpm release:check -- --strict-live
git status --short
```

Expected: both checks pass on the 3.0.0 tree. Status contains only the expected version/evidence/doc work; no generated private file appears.

- [ ] **Step 5: Build and start the release-evidence production server**

```bash
NEXT_PUBLIC_WILDZ_DIAGNOSTICS=1 NEXT_PUBLIC_WILDZ_SW_RELEASE=v3.0.0 pnpm build
NEXT_PUBLIC_WILDZ_DIAGNOSTICS=1 NEXT_PUBLIC_WILDZ_SW_RELEASE=v3.0.0 pnpm start -p 3001
```

Expected: production build passes and server listens on `http://127.0.0.1:3001`. Keep it in its own terminal. Stable data attributes expose only values already visible in the rendered UI; they do not bypass verification, mock capability, or weaken production behavior.

- [ ] **Step 6: Verify live response headers before UI work**

```bash
node -e "fetch('http://127.0.0.1:3001/').then(r=>{for(const k of ['content-security-policy','x-content-type-options','referrer-policy','x-frame-options','permissions-policy','cross-origin-opener-policy'])if(!r.headers.get(k))throw new Error('missing_'+k); console.log('security_headers_ok')})"
node -e "fetch('http://127.0.0.1:3001/sw.js').then(r=>{if(!/no-cache|no-store/.test(r.headers.get('cache-control')||''))throw new Error('sw_cache_header'); console.log('service_worker_header_ok')})"
```

Expected: only the two success markers print.

- [ ] **Step 7: Create fresh WebKit and Chromium sessions, measure first paint/bundle load, and capture the responsive matrix**

```bash
mkdir -p output/playwright/v3-release
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-320 open about:blank --browser webkit
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-320 delete-data
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-320 resize 320 568
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-390 open about:blank --browser webkit
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-390 delete-data
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-390 resize 390 844
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-430 open about:blank --browser webkit
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-430 delete-data
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-430 resize 430 932
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop open about:blank --browser webkit
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop delete-data
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop resize 1440 900
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-320 open about:blank --browser chromium
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-320 delete-data
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-320 resize 320 568
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-390 open about:blank --browser chromium
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-390 delete-data
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-390 resize 390 844
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-430 open about:blank --browser chromium
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-430 delete-data
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-430 resize 430 932
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-desktop open about:blank --browser chromium
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-desktop delete-data
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-desktop resize 1440 900
```

Navigate each empty session exactly once and measure browser FCP, first visible Wildz shell, and initially loaded JavaScript bytes. The callback defines its byte fallback and uses the same production URL for every engine:

```bash
PWCLI=/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh
for session in v3-320 v3-390 v3-430 v3-desktop v3-chromium-320 v3-chromium-390 v3-chromium-430 v3-chromium-desktop; do
  "$PWCLI" --session "$session" run-code "async (page) => { const started = Date.now(); await page.goto('http://127.0.0.1:3001', { waitUntil: 'networkidle' }); await page.locator('.wildz-app').waitFor({ state: 'visible' }); const firstVisibleWildzMs = Date.now() - started; const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null); const initialJsBytes = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => entry.name.includes('/_next/static/') && entry.name.endsWith('.js')).reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0)); const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth); if (fcp === null || fcp > 5000) throw new Error('first_contentful_paint_budget'); if (firstVisibleWildzMs > 5000) throw new Error('first_visible_wildz_budget'); if (initialJsBytes <= 0 || initialJsBytes > 2000000) throw new Error('initial_javascript_budget'); if (overflow) throw new Error('document_horizontal_overflow'); return { ok: true, firstContentfulPaintMs: Math.round(fcp), firstVisibleWildzMs, initialJsBytes }; }"
done
```

Expected: all eight fresh navigations report measurable FCP, visible shell within 5 seconds, initially loaded JavaScript no greater than 2,000,000 transferred/encoded bytes, and no horizontal document overflow. Record each actual value; do not replace it with the budget.

Capture the eight sanitized screenshots after taking a fresh snapshot in each session:

```bash
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-320 snapshot
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-320 screenshot --full-page --filename output/playwright/v3-release/webkit-home-320x568.png
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-390 snapshot
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-390 screenshot --full-page --filename output/playwright/v3-release/webkit-home-390x844.png
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-430 snapshot
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-430 screenshot --full-page --filename output/playwright/v3-release/webkit-home-430x932.png
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop snapshot
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop screenshot --full-page --filename output/playwright/v3-release/webkit-home-1440x900.png
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-320 snapshot
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-320 screenshot --full-page --filename output/playwright/v3-release/chromium-home-320x568.png
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-390 snapshot
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-390 screenshot --full-page --filename output/playwright/v3-release/chromium-home-390x844.png
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-430 snapshot
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-430 screenshot --full-page --filename output/playwright/v3-release/chromium-home-430x932.png
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-desktop snapshot
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-desktop screenshot --full-page --filename output/playwright/v3-release/chromium-home-1440x900.png
```

Expected: all eight pages render the standalone shell without clipped fixed controls, browser framing, or commerce navigation. Screenshots contain no private artifact data.

- [ ] **Step 8: Prove 44-pixel targets, focus trap/restore, Escape, keyboard scan, and WebGL recovery**

Run against both 320-pixel sessions after their snapshots:

```bash
PWCLI=/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh
for session in v3-320 v3-chromium-320; do
  "$PWCLI" --session "$session" run-code "async (page) => { const targets = page.locator('.wildz-app :is(button,a[href],select,input:not([type=hidden]),textarea,[role=button]):visible'); const bad = await targets.evaluateAll(nodes => nodes.filter(node => { const box = node.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).length); if (bad) throw new Error('wildz_target_under_44'); return { ok: true, checked: await targets.count() }; }"
  "$PWCLI" --session "$session" run-code "async (page) => { const trigger = page.getByRole('button', { name: 'Open card vault' }); await trigger.focus(); await trigger.click(); const dialog = page.getByRole('dialog'); await dialog.waitFor(); for (let index = 0; index < 12; index += 1) { await page.keyboard.press('Tab'); if (!await dialog.evaluate((node) => node.contains(document.activeElement))) throw new Error('focus_left_dialog'); } await page.keyboard.press('Escape'); if (await trigger.evaluate((node) => document.activeElement !== node)) throw new Error('focus_not_restored'); return { ok: true }; }"
  "$PWCLI" --session "$session" run-code "async (page) => { await page.locator('canvas').focus(); const before = await page.locator('[data-wildz-scan-status]').textContent(); await page.keyboard.press('e'); await page.waitForFunction((value) => document.querySelector('[data-wildz-scan-status]')?.textContent !== value, before); return { ok: true }; }"
  "$PWCLI" --session "$session" run-code "async (page) => { const canvas = page.locator('canvas').first(); await canvas.evaluate((node) => node.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))); await page.locator('[data-wildz-webgl-status=lost]').waitFor(); await canvas.evaluate((node) => node.dispatchEvent(new Event('webglcontextrestored'))); await page.waitForFunction(() => document.querySelector('[data-wildz-webgl-status=ready]')); return { ok: true }; }"
done
```

Expected: every script returns `ok: true` in both engines; zero target is undersized; focus never leaves the dialog and returns to the exact trigger; `e` changes scan status; synthetic context loss recovers without page reload or state reset.

- [ ] **Step 9: Import every sanitized writer artifact and prove complete card surfaces in both engines**

Use both desktop sessions and the validated manifest. The callback defines every comparison helper it uses and proves the source-writer orders through the real rail and every Card Vault page:

```bash
PWCLI=/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh
for session in v3-desktop v3-chromium-desktop; do
  "$PWCLI" --session "$session" run-code "async (page) => { const { readFile } = await import('node:fs/promises'); const { dirname, resolve } = await import('node:path'); const manifestPath = process.env.WILDZ_INTEROP_MANIFEST; if (!manifestPath) throw new Error('interop_manifest_missing'); const manifest = JSON.parse(await readFile(manifestPath, 'utf8')); const unique = values => [...new Set(values)].sort((a, b) => a.localeCompare(b)); const same = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]); const activeUsername = async () => page.locator('[data-wildz-active-username]').first().getAttribute('data-wildz-active-username'); const renderedIds = async () => unique(await page.locator('[data-wildz-card-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-wildz-card-id')).filter(Boolean))); const results = []; let expectedActiveIds = await renderedIds(); for (const entry of manifest.artifacts) { const artifactPath = resolve(dirname(manifestPath), entry.path); await page.locator('[data-wildz-artifact-input]').setInputFiles(artifactPath); await page.locator('[data-wildz-restore-status]').filter({ hasText: /verified|restored|imported/i }).waitFor(); const importedIds = unique(entry.verifiedWildzCardIds); expectedActiveIds = entry.embeddedUsername ? importedIds : unique([...expectedActiveIds, ...importedIds]); const actual = await renderedIds(); if (!same(actual, expectedActiveIds)) throw new Error('interop_card_set_mismatch'); if (entry.verifiedUnrelatedDomainIds.some(id => actual.includes(id))) throw new Error('unrelated_domain_admitted'); if (entry.embeddedUsername && await activeUsername() !== entry.embeddedUsername) throw new Error('interop_embedded_username_mismatch'); if (entry.embeddedUsername) { await page.reload({ waitUntil: 'networkidle' }); if (await activeUsername() !== entry.embeddedUsername) throw new Error('interop_cold_username_mismatch'); if (!same(await renderedIds(), expectedActiveIds)) throw new Error('interop_cold_card_set_mismatch'); } results.push({ writer: entry.writer, artifactKind: entry.artifactKind, ok: true, exactUsername: entry.embeddedUsername ? true : null, importedUniqueCardCount: importedIds.length, activeUniqueCardCount: expectedActiveIds.length, unrelatedRejected: entry.verifiedUnrelatedDomainIds.length }); } const finalEntry = manifest.artifacts.find(entry => entry.writer === 'sdk-compatible'); if (!finalEntry?.expectedCardOrders) throw new Error('interop_expected_orders_missing'); const trigger = page.getByRole('button', { name: 'Open card vault' }); await trigger.click(); const dialog = page.getByRole('dialog'); await dialog.waitFor(); const orderEvidence = {}; for (const order of ['rarity', 'newest', 'oldest']) { const expected = finalEntry.expectedCardOrders[order]; await dialog.getByRole('combobox', { name: 'Card order' }).selectOption(order); await page.waitForFunction(firstId => document.querySelector('[data-wildz-vault-page]')?.getAttribute('data-wildz-vault-page') === '0' && document.querySelector('[data-wildz-rail-card-id]')?.getAttribute('data-wildz-rail-card-id') === firstId, expected[0]); const railIds = await page.locator('[data-wildz-rail-card-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-wildz-rail-card-id')).filter(Boolean)); if (!same(railIds, expected)) throw new Error('rail_order_mismatch_' + order); const railScroll = await page.locator('[data-wildz-card-rail]').evaluate(node => { node.scrollLeft = node.scrollWidth; return { overflow: node.scrollWidth > node.clientWidth, left: node.scrollLeft }; }); if (!railScroll.overflow || railScroll.left <= 0) throw new Error('rail_not_horizontally_scrollable'); const vaultIds = []; for (let guard = 0; guard < 100; guard += 1) { vaultIds.push(...await dialog.locator('[data-wildz-vault-card-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-wildz-vault-card-id')).filter(Boolean))); const next = dialog.getByRole('button', { name: 'Next card page' }); if (await next.isDisabled()) break; const currentPage = Number(await dialog.locator('[data-wildz-vault-page]').getAttribute('data-wildz-vault-page')); await next.click(); await page.waitForFunction(value => document.querySelector('[data-wildz-vault-page]')?.getAttribute('data-wildz-vault-page') === String(value), currentPage + 1); if (guard === 99) throw new Error('vault_pagination_unbounded'); } if (!same(vaultIds, expected)) throw new Error('vault_order_mismatch_' + order); orderEvidence[order] = { railCount: railIds.length, vaultCount: vaultIds.length, horizontalScroll: true }; } await page.keyboard.press('Escape'); await page.evaluate(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.__wildzSharedUrl = data.url; } }); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__wildzCopiedUrl = value; } } }); }); await page.getByRole('button', { name: 'Player Profile' }).click(); const profile = page.getByRole('dialog'); await profile.waitFor(); await profile.getByRole('button', { name: 'Copy Link' }).click(); await profile.getByText('Profile link copied.').waitFor(); await profile.getByRole('button', { name: 'Share' }).click(); await profile.getByText('Profile shared.').waitFor(); const sharePaths = await page.evaluate(() => ({ shared: new URL(window.__wildzSharedUrl).pathname, copied: new URL(window.__wildzCopiedUrl).pathname })); if (!sharePaths.shared.startsWith('/u/') || sharePaths.copied !== sharePaths.shared) throw new Error('profile_share_path_mismatch'); await page.keyboard.press('Escape'); return { writers: results, cardOrders: orderEvidence, profileShareCopy: true }; }"
done
```

Expected: both WebKit and Chromium return `ok: true` for every named writer; the matrix includes a real Identity Seal and identity-bearing Vault; every embedded username becomes the exact active username and survives reload. Identity-bearing artifacts restore their exact sorted card set; card-only artifacts add their complete verified set to the active owner without dropping prior unique IDs; unrelated domains never become cards. In both engines, the rail is genuinely horizontally scrollable, contains every final card, and matches the source-computed rarity/newest/oldest order; aggregating every reachable Card Vault page yields the same complete order. Both real profile controls emit the same canonical `/u/` URL through their browser ports. A duplicate identical ID may collapse; any unique missing/extra ID fails.

- [ ] **Step 10: Probe auth, world, card, profile, and market APIs directly**

Use the configured desktop browser context so its real cookies and headers are preserved. Every helper used by the callback is defined inside it:

```bash
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop run-code "async (page) => { const { readFile } = await import('node:fs/promises'); const manifest = JSON.parse(await readFile(process.env.WILDZ_INTEROP_MANIFEST, 'utf8')); const evidence = manifest.publicEvidence; const readJson = async path => { const response = await page.request.get(new URL(path, page.url()).href); if (!response.ok()) throw new Error('release_api_status_failed'); return { status: response.status(), body: await response.json() }; }; const containsScalar = (value, expected) => value === expected || (Array.isArray(value) ? value.some(item => containsScalar(item, expected)) : Boolean(value && typeof value === 'object' && Object.values(value).some(item => containsScalar(item, expected)))); const safe = value => !/accessToken|refreshToken|clientSecret|privateKey|passphrase|ciphertext/i.test(JSON.stringify(value)); const auth = await readJson('/api/auth/receiz/me'); if (!safe(auth.body) || typeof auth.body.connected !== 'boolean') throw new Error('auth_projection_unsafe'); const world = await readJson('/api/wilds/world/snapshot'); const worldKeys = Object.keys(world.body).sort(); if (JSON.stringify(worldKeys) !== JSON.stringify(['mode', 'ok', 'projection']) || world.body.ok !== true || !['receiz_live', 'local_practice'].includes(world.body.mode)) throw new Error('world_snapshot_contract'); const card = await readJson(evidence.cardApiPath); const cardId = decodeURIComponent(evidence.cardApiPath.split('/').at(-1)); if (!safe(card.body) || !containsScalar(card.body, cardId)) throw new Error('card_projection_contract'); const profile = await readJson(evidence.profileApiPath); const handle = decodeURIComponent(evidence.profileApiPath.split('/').at(-1)); if (!safe(profile.body) || !containsScalar(profile.body, handle)) throw new Error('profile_projection_contract'); const market = await readJson('/api/market/listings'); if (!safe(market.body) || /simulated|mock-success/i.test(JSON.stringify(market.body))) throw new Error('market_projection_contract'); return { ok: true, auth: auth.status, world: world.status, worldMode: world.body.mode, card: card.status, profile: profile.status, market: market.status }; }"
```

Expected: all five direct read probes return successful real schemas; auth/profile/card responses contain no private material; world has exactly one `{ ok, projection, mode }` layer; market does not advertise simulated authority. This step performs no POST, PUT, PATCH, or DELETE.

- [ ] **Step 11: Run the historical private Vault exact-identity and exact-card gate**

Use new WebKit and Chromium sessions. Do not take a screenshot or snapshot after private import. Begin with a fresh snapshot in each engine before import, then compare only in memory and return booleans/counts:

```bash
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-private-webkit open http://127.0.0.1:3001 --browser webkit
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-private-webkit delete-data
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-private-webkit resize 390 844
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-private-webkit goto http://127.0.0.1:3001
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-private-webkit snapshot
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-private-chromium open http://127.0.0.1:3001 --browser chromium
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-private-chromium delete-data
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-private-chromium resize 390 844
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-private-chromium goto http://127.0.0.1:3001
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-private-chromium snapshot
PWCLI=/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh
for session in v3-private-webkit v3-private-chromium; do
  "$PWCLI" --session "$session" run-code "async (page) => { const { readFile } = await import('node:fs/promises'); const vaultPath = process.env.WILDZ_PRIVATE_VAULT_PATH; const expectationPath = process.env.WILDZ_PRIVATE_VAULT_EXPECTATION_PATH; if (!vaultPath || !expectationPath) throw new Error('private_gate_input_missing'); let expectation; try { expectation = JSON.parse(await readFile(expectationPath, 'utf8')); } catch { throw new Error('private_expectation_unreadable'); } const unique = values => [...new Set(values)].sort((a, b) => a.localeCompare(b)); const same = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]); const activeUsername = async () => page.locator('[data-wildz-active-username]').first().getAttribute('data-wildz-active-username'); const renderedIds = async () => unique(await page.locator('[data-wildz-card-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-wildz-card-id')).filter(Boolean))); const prior = await activeUsername(); if (prior === expectation.embeddedUsername) throw new Error('private_gate_requires_distinct_prior_identity'); try { await page.locator('[data-wildz-artifact-input]').setInputFiles(vaultPath); } catch { throw new Error('private_vault_upload_failed'); } await page.locator('[data-wildz-restore-status]').filter({ hasText: /restored|verified/i }).waitFor(); const expectedIds = unique(expectation.verifiedWildzCardIds); if (await activeUsername() !== expectation.embeddedUsername) throw new Error('private_embedded_username_not_active'); if (!same(await renderedIds(), expectedIds)) throw new Error('private_verified_card_set_mismatch'); await page.reload({ waitUntil: 'networkidle' }); if (await activeUsername() !== expectation.embeddedUsername) throw new Error('private_cold_username_mismatch'); if (!same(await renderedIds(), expectedIds)) throw new Error('private_cold_card_set_mismatch'); return { ok: true, switchedFromPrior: true, exactUsername: true, exactCardSet: true, coldRelaunch: true, uniqueCardCount: expectedIds.length }; }"
done
```

Expected: both engines return only booleans and count. In each engine the active username is the exact embedded username, never the prior/current fallback, both before and after reload. The actual sorted unique IDs exactly equal every verified Vault card ID before and after reload. The command output, docs, and evidence JSON must not include the username, IDs, file path, hash, or bytes.

- [ ] **Step 12: Export sanitized Wildz artifacts from both engines and verify official SDK/source readers**

Use the same sanitized current-Wildz state in both desktop engines and save each pair to its preconfigured local paths:

```bash
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop run-code "async (page) => { const sealDownload = page.waitForEvent('download'); await page.getByRole('button', { name: /export identity seal/i }).click(); await (await sealDownload).saveAs(process.env.WILDZ_RELEASE_EXPORTED_SEAL_WEBKIT); const vaultDownload = page.waitForEvent('download'); await page.getByRole('button', { name: /export.*vault/i }).click(); await (await vaultDownload).saveAs(process.env.WILDZ_RELEASE_EXPORTED_VAULT_WEBKIT); return { ok: true, engine: 'webkit' }; }"
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-desktop run-code "async (page) => { const sealDownload = page.waitForEvent('download'); await page.getByRole('button', { name: /export identity seal/i }).click(); await (await sealDownload).saveAs(process.env.WILDZ_RELEASE_EXPORTED_SEAL_CHROMIUM); const vaultDownload = page.waitForEvent('download'); await page.getByRole('button', { name: /export.*vault/i }).click(); await (await vaultDownload).saveAs(process.env.WILDZ_RELEASE_EXPORTED_VAULT_CHROMIUM); return { ok: true, engine: 'chromium' }; }"
WILDZ_RELEASE_ARTIFACT_GATE=1 node --test .test-build/tests/wildz-release-export-live.test.js
```

Expected: both browser exports succeed; the official SDK reads identity authority from all four artifacts; source readers verify each Wildz PNG/V3 payload and the exact sanitized card set. No artifact content is printed or committed.

- [ ] **Step 13: Verify configured and unconfigured market behavior**

On the configured 3001 server, open Social Market in `v3-desktop`, confirm authoritative read state and capability status, and do not start a purchase or mutation:

```bash
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop run-code "async (page) => { await page.getByRole('button', { name: /social market/i }).click(); const dialog = page.getByRole('dialog'); await dialog.waitFor(); if (!await dialog.getByText(/live|connected|available/i).count()) throw new Error('configured_market_not_authoritative'); return { ok: true, mutationPerformed: false }; }"
```

Stop the 3001 server and start the same production build without release tokens on 3002:

```bash
env -u RECEIZ_ACCESS_TOKEN -u RECEIZ_CONNECT_ACCESS_TOKEN pnpm start -p 3002
```

Then run:

```bash
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-market-offline open http://127.0.0.1:3002 --browser webkit
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-market-offline delete-data
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-market-offline resize 390 844
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-market-offline goto http://127.0.0.1:3002
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-market-offline snapshot
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-market-offline run-code "async (page) => { await page.getByRole('button', { name: /social market/i }).click(); const dialog = page.getByRole('dialog'); await dialog.waitFor(); if (!await dialog.getByText(/unavailable|configuration|required|offline/i).count()) throw new Error('unconfigured_market_did_not_fail_closed'); const enabledMutations = await dialog.locator('button:not([disabled])').filter({ hasText: /buy|list|offer|trade|checkout/i }).count(); if (enabledMutations) throw new Error('unconfigured_market_mutation_enabled'); return { ok: true, failedClosed: true }; }"
```

Expected: configured read-only market reports real authority; unconfigured market visibly fails closed with all mutation controls disabled. No remote market mutation occurs. Stop 3002 and restart the configured evidence server on 3001 before continuing.

- [ ] **Step 14: Rehearse install consent, offline boundaries, and explicit worker update**

First validate install consent with a synthetic browser install event; this proves UI consent, not native WebKit installation support:

```bash
PWCLI=/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh
for session in v3-desktop v3-chromium-desktop; do
  "$PWCLI" --session "$session" run-code "async (page) => { await page.evaluate(() => { const event = new Event('beforeinstallprompt', { cancelable: true }); let calls = 0; Object.defineProperties(event, { prompt: { value: async () => { calls += 1; } }, userChoice: { value: Promise.resolve({ outcome: 'dismissed', platform: 'release-test' }) }, releasePromptCalls: { get: () => calls } }); window.__wildzInstallEvent = event; window.dispatchEvent(event); }); const button = page.getByRole('button', { name: 'Install Wildz' }); await button.waitFor(); const before = await page.evaluate(() => window.__wildzInstallEvent.releasePromptCalls); if (before !== 0) throw new Error('install_prompt_without_consent'); await button.click(); const after = await page.evaluate(() => window.__wildzInstallEvent.releasePromptCalls); if (after !== 1) throw new Error('install_prompt_count'); return { ok: true, consentRequired: true }; }"
done
```

Warm the manifest's sanitized `/u/` page, `/cards/` page, and GET card API while online, and retain only their public paths in session storage:

```bash
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop run-code "async (page) => { const { readFile } = await import('node:fs/promises'); const manifest = JSON.parse(await readFile(process.env.WILDZ_INTEROP_MANIFEST, 'utf8')); const evidence = manifest.publicEvidence; const ownerUsername = await page.locator('[data-wildz-active-username]').first().getAttribute('data-wildz-active-username'); const ownerCardIds = await page.locator('[data-wildz-card-id]').evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('data-wildz-card-id')).filter(Boolean))].sort()); if (!ownerUsername) throw new Error('sanitized_offline_owner_missing'); const profile = await page.goto(new URL(evidence.profileDocumentPath, page.url()).href, { waitUntil: 'networkidle' }); if (!profile?.ok()) throw new Error('public_profile_warm_failed'); const card = await page.goto(new URL(evidence.cardDocumentPath, page.url()).href, { waitUntil: 'networkidle' }); if (!card?.ok()) throw new Error('public_card_warm_failed'); const apiOk = await page.evaluate(async path => (await fetch(path)).ok, evidence.cardApiPath); if (!apiOk) throw new Error('card_api_warm_failed'); await page.evaluate(value => { sessionStorage.setItem('wildz-release-public-evidence', JSON.stringify(value)); }, { ...evidence, ownerUsername, ownerCardIds }); return { ok: true }; }"
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop network-state-set offline
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop run-code "async (page) => { const evidence = JSON.parse(await page.evaluate(() => sessionStorage.getItem('wildz-release-public-evidence'))); const unique = values => [...new Set(values)].sort((a, b) => a.localeCompare(b)); const same = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]); const cachedCardApi = await page.evaluate(async path => (await fetch(path)).ok, evidence.cardApiPath); const root = await page.goto(new URL('/', page.url()).href, { waitUntil: 'domcontentloaded' }); if (!root?.ok()) throw new Error('offline_root_shell_missing'); await page.locator('[data-wildz-active-username]').waitFor(); const rootUsername = await page.locator('[data-wildz-active-username]').first().getAttribute('data-wildz-active-username'); const rootCardIds = unique(await page.locator('[data-wildz-card-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-wildz-card-id')).filter(Boolean))); if (rootUsername !== evidence.ownerUsername || !same(rootCardIds, unique(evidence.ownerCardIds))) throw new Error('offline_owner_continuity_mismatch'); const profile = await page.goto(new URL(evidence.profileDocumentPath, page.url()).href, { waitUntil: 'domcontentloaded' }); if (!profile?.ok() || /connection required|offline/i.test(await page.locator('body').innerText())) throw new Error('cached_profile_missing'); const card = await page.goto(new URL(evidence.cardDocumentPath, page.url()).href, { waitUntil: 'domcontentloaded' }); if (!card?.ok() || /connection required|offline/i.test(await page.locator('body').innerText())) throw new Error('cached_card_missing'); await page.goto(new URL('/u/wildz-release-never-visited', page.url()).href, { waitUntil: 'domcontentloaded' }); if (!/connection required|offline/i.test(await page.locator('body').innerText())) throw new Error('offline_fallback_missing'); const fails = async (path, init) => { try { await page.evaluate(async ([url, options]) => { await fetch(url, options); }, [path, init]); return false; } catch { return true; } }; const authFailed = await fails('/api/auth/receiz/me'); const worldFailed = await fails('/api/wilds/world/snapshot'); const mutationFailed = await fails('/api/wilds/world/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); const marketFailed = await fails('/api/market/listings'); const proxyFailed = await fails('/api/document-verify'); if (!cachedCardApi || !authFailed || !worldFailed || !mutationFailed || !marketFailed || !proxyFailed) throw new Error('offline_cache_boundary_failed'); return { ok: true, rootOwnerContinuity: true, cachedPublicDocuments: true, cachedCardGet: true, networkOnlyRails: true }; }"
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop network-state-set online
```

Expected: cached `/` starts the exact sanitized owner and complete card set from verified IndexedDB continuity; the exact visited public pages and card GET remain readable; the never-visited profile shows the truthful offline copy; authentication, world, market, proxy, and mutation requests remain network failures and are not served from a cache.

For a real waiting-worker transition, build and run `qa-a`, visit once in a dedicated `v3-update` session, stop the server, build and run `qa-b`, and use the same session:

```bash
NEXT_PUBLIC_WILDZ_SW_RELEASE=v3.0.0-qa-a pnpm build
NEXT_PUBLIC_WILDZ_SW_RELEASE=v3.0.0-qa-a pnpm start -p 3001
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-update open http://127.0.0.1:3001 --browser webkit
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-update delete-data
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-update goto http://127.0.0.1:3001
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-update snapshot
```

After stopping `qa-a`:

```bash
NEXT_PUBLIC_WILDZ_SW_RELEASE=v3.0.0-qa-b pnpm build
NEXT_PUBLIC_WILDZ_SW_RELEASE=v3.0.0-qa-b pnpm start -p 3001
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-update reload
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-update run-code "async (page) => { await page.evaluate(() => { window.__wildzPreserveEvents = 0; window.addEventListener('wildz:preserve-state', () => { window.__wildzPreserveEvents += 1; }); }); const button = page.getByRole('button', { name: 'Apply update' }); await button.waitFor(); const before = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || ''); if (!before.includes('qa-a')) throw new Error('old_worker_not_controlling'); await button.click(); await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes('qa-b')); const preserved = await page.evaluate(() => window.__wildzPreserveEvents); if (preserved !== 1) throw new Error('state_not_preserved_before_update'); return { ok: true, explicitApply: true, preserved: true }; }"
```

Expected: install prompt is called only after click; cached public/card reads work offline; uncached public navigation shows truthful offline copy; world/market/mutations remain network failures; `qa-a` controls until Apply Update is clicked; preserve fires once; `qa-b` then controls without forced page reload.

Stop `qa-b`, rebuild and restart the exact final evidence build, then reload both desktop engines:

```bash
NEXT_PUBLIC_WILDZ_DIAGNOSTICS=1 NEXT_PUBLIC_WILDZ_SW_RELEASE=v3.0.0 pnpm build
NEXT_PUBLIC_WILDZ_DIAGNOSTICS=1 NEXT_PUBLIC_WILDZ_SW_RELEASE=v3.0.0 pnpm start -p 3001
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-desktop reload
/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh --session v3-chromium-desktop reload
```

Expected: both desktop sessions render the exact v3.0.0 worker/build before final diagnostics.

- [ ] **Step 15: Capture bounded diagnostics and clean browser logs**

```bash
PWCLI=/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh
for session in v3-desktop v3-chromium-desktop; do
  "$PWCLI" --session "$session" run-code "async (page) => { await page.evaluate(() => window.dispatchEvent(new Event('wildz:sample-diagnostics'))); await page.waitForFunction(() => Boolean(window.__THREE_GAME_DIAGNOSTICS__)); return page.evaluate(() => { const value = window.__THREE_GAME_DIAGNOSTICS__; const detailed = value.detailedRender; if (!value.budget.ok || detailed.ecology > 2 || detailed.bosses > 1 || detailed.supports > 2) throw new Error('renderer_budget_failed'); return { calls: value.renderer.render.calls, triangles: value.renderer.render.triangles, geometries: value.renderer.memory.geometries, textures: value.renderer.memory.textures, budgetOk: true, ecology: detailed.ecology, bosses: detailed.bosses, supports: detailed.supports, tier: value.quality.tier, dpr: value.quality.dpr }; }); }"
done
for session in v3-320 v3-390 v3-430 v3-desktop v3-chromium-320 v3-chromium-390 v3-chromium-430 v3-chromium-desktop; do
  "$PWCLI" --session "$session" console error
  "$PWCLI" --session "$session" console warning
done
```

Expected: both desktop engines report the configured renderer budget as passing and detailed counts at or below 2/1/2 after an explicit sample; production source has no polling interval; every console is empty of application errors. Warning output is empty except for an exact context-loss/restoration warning caused by the synthetic recovery exercise in the two 320 sessions; record that warning as test-induced and reject every other warning.

- [ ] **Step 16: Write browser results and truthful release documentation**

Create `output/playwright/v3-release/browser-results.json` from the actual sanitized results with schema `wildz.release.browser.v1`. Include build version, commit-under-test, all eight engine/dimension cases, actual FCP, first-visible Wildz time, initially loaded JavaScript bytes, pass/fail booleans, target count, focus/scan/WebGL results, direct auth/world/card/profile/market read statuses, per-engine writer labels and sanitized counts, per-engine rarity/newest/oldest rail/Vault counts and horizontal-scroll booleans, dual-engine export-reader results, configured/unconfigured market results, offline/update results, and both desktop renderer diagnostic summaries. Record separate `webkit` and `chromium` historical-Vault objects containing only `passed`, `switchedFromPrior`, `exactUsername`, `exactCardSet`, `coldRelaunch`, and `uniqueCardCount`; exclude the username, IDs, path, hash, bytes, and source metadata.

Update release documents only from completed evidence:

- `feature-parity.md` maps each V3 requirement to its actual module/test/browser evidence and identifies any unavailable live mutation as unavailable rather than simulated;
- `verification.md` records exact commands, exit statuses, all four dimensions in WebKit and Chromium, FCP/first-visible/initial-JavaScript measurements, production URL, direct API probes, clean logs, dual-engine renderer diagnostics, PWA rehearsal, market modes, artifact gates, and strict doctor status;
- `v3.0.0.md` contains user-facing release notes plus the exact offline boundary and remote capability boundary;
- `artifact-interoperability.md` records the six non-private writer labels, versions/commits, digests, sanitized Wildz card IDs/counts, unrelated-domain rejection, dual-engine current-Wildz export SDK/source-reader verification, and only the sanitized private gate result;
- `RECEIZ_RAILS.md` and `MCP.md` describe SDK 100.0.0 and MCP compatibility accurately. If MCP was not invoked, state that it was not invoked in this release qualification;
- AI skill files describe real operator procedures, proof precedence, read-only diagnostics, and required human confirmation. Do not claim an AI skill, MCP server, writer, browser journey, or remote mutation ran unless evidence exists.

- [ ] **Step 17: Add and run documentation truth contracts**

Create `tests/wildz-release-documentation.test.ts` to assert:

- package version is exactly 3.0.0;
- release docs name WebKit and Chromium, all four dimensions, the six writer labels, direct API probes, first-paint measurements, initially loaded JavaScript bytes, and dual-engine renderer diagnostics;
- release docs and browser results record dual-engine Identity Seal/Vault restore, current-Wildz export-reader verification, horizontal all-card rail scrolling, complete Card Vault pagination, and all three `rarity`, `newest`, and `oldest` modes;
- offline docs say public profiles/cards and card GETs only, and explicitly exclude auth/world/market/mutations;
- private evidence contains none of the expectation file's username or IDs when the local expectation path is present;
- docs do not claim MCP execution when `browser-results.json` has no MCP evidence;
- `feature-parity.md` points to existing paths/tests;
- no release document contains an assigned credential value, private artifact path, or raw key schema payload.

Use this self-contained test shape:

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const releasePaths = [
  "docs/release/feature-parity.md",
  "docs/release/verification.md",
  "docs/release/v3.0.0.md",
  "docs/release/artifact-interoperability.md",
  "docs/RECEIZ_RAILS.md",
  "docs/MCP.md",
  "ai-skills/README.md",
  "ai-skills/wildz-builder-skill/SKILL.md",
  "ai-skills/wildz-market-operator-skill/SKILL.md",
  "ai-skills/wildz-release-skill/SKILL.md"
];
const text = releasePaths.map((path) => readFileSync(path, "utf8")).join("\n");
const results = JSON.parse(readFileSync("output/playwright/v3-release/browser-results.json", "utf8")) as {
  mcp?: { executed?: boolean };
};

test("release evidence names the exact build, browser, performance, API, and writer matrix", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  assert.equal(pkg.version, "3.0.0");
  for (const value of ["WebKit", "Chromium", "320x568", "390x844", "430x932", "1440x900", "first contentful paint", "JavaScript bytes", "auth", "world", "card", "profile", "market"]) assert.match(text, new RegExp(value, "i"));
  for (const writer of ["receiz-commerce", "receiz-app", "receiz-signal", "receiz-sealed-card", "wildz-original", "sdk-compatible"]) assert.match(text, new RegExp(writer));
});

test("offline and authority documentation state the real boundary", () => {
  assert.match(text, /visited public (?:profiles|cards)/i);
  assert.match(text, /GET card/i);
  for (const value of ["auth", "world", "market", "mutation"]) assert.match(text, new RegExp(`${value}.*(?:online|connection|not cached|unavailable)`, "i"));
  if (!results.mcp?.executed) assert.match(text, /MCP was not invoked in this release qualification/i);
});

test("feature evidence points to existing implementation boundaries", () => {
  const parity = readFileSync("docs/release/feature-parity.md", "utf8");
  for (const path of [
    "src/lib/receiz/wildz-artifact-codec.ts",
    "src/lib/receiz/wilds-world-repository.ts",
    "src/lib/receiz/wildz-market-repository.ts",
    "src/features/play/WildsWorldCanvas.tsx",
    "public/sw.js",
    "tests/wildz-release-evidence.test.ts"
  ]) {
    assert.equal(existsSync(path), true, path);
    assert.match(parity, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("release evidence excludes private expectation values and credential assignments", () => {
  const expectationPath = process.env.WILDZ_PRIVATE_VAULT_EXPECTATION_PATH;
  if (expectationPath) {
    const expectation = JSON.parse(readFileSync(expectationPath, "utf8")) as { embeddedUsername: string; verifiedWildzCardIds: string[] };
    for (const privateValue of [expectation.embeddedUsername, ...expectation.verifiedWildzCardIds]) assert.equal(text.includes(privateValue), false);
  }
  assert.doesNotMatch(text, /(?:ACCESS_TOKEN|CLIENT_SECRET|OAUTH_STATE_SECRET)=[^\s<]{4,}/);
  assert.doesNotMatch(text, /"privateKeyPkcs8(?:Ciphertext)?B64u"\s*:/);
  if (process.env.WILDZ_PRIVATE_VAULT_PATH) assert.equal(text.includes(process.env.WILDZ_PRIVATE_VAULT_PATH), false);
});
```

Then run:

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-release-documentation.test.js .test-build/tests/wildz-release-evidence.test.js .test-build/tests/wildz-release-export-live.test.js
pnpm secret:scan
```

Expected: documentation tests and secret scan pass. The environment-dependent export test is run with `WILDZ_RELEASE_ARTIFACT_GATE=1` as in Step 12 before treating it as release evidence.

- [ ] **Step 18: Rebuild the exact final worker and rerun terminal gates**

Stop every local server, then run:

```bash
node scripts/next-runtime-guard.mjs assert-idle
NEXT_PUBLIC_WILDZ_DIAGNOSTICS=0 NEXT_PUBLIC_WILDZ_SW_RELEASE=v3.0.0 pnpm build
pnpm release:check
pnpm release:check -- --strict-live
git diff --check
git status --short
```

Expected: all gates pass on the exact final tree; diagnostics default off; worker release is v3.0.0; no whitespace error; status contains only intended release/version/docs/tests and sanitized browser evidence. No private artifact or expectation file appears.

- [ ] **Step 19: Inspect the exact release diff**

```bash
git diff --stat
git diff -- package.json docs/release/feature-parity.md docs/release/verification.md docs/release/v3.0.0.md docs/release/artifact-interoperability.md docs/RECEIZ_RAILS.md docs/MCP.md ai-skills/README.md ai-skills/wildz-builder-skill/SKILL.md ai-skills/wildz-market-operator-skill/SKILL.md ai-skills/wildz-release-skill/SKILL.md tests/wildz-release-documentation.test.ts output/playwright/v3-release/browser-results.json
```

Expected: version is 3.0.0; docs match actual evidence; skill/MCP language is procedural and truthful; browser results are sanitized; there is no credential, private username, private card ID, raw artifact, or unverified success claim.

- [ ] **Step 20: Create the final release commit only now**

```bash
git add package.json docs/release/feature-parity.md docs/release/verification.md docs/release/v3.0.0.md docs/release/artifact-interoperability.md docs/RECEIZ_RAILS.md docs/MCP.md ai-skills/README.md ai-skills/wildz-builder-skill/SKILL.md ai-skills/wildz-market-operator-skill/SKILL.md ai-skills/wildz-release-skill/SKILL.md tests/wildz-release-documentation.test.ts output/playwright/v3-release/browser-results.json output/playwright/v3-release/webkit-home-320x568.png output/playwright/v3-release/webkit-home-390x844.png output/playwright/v3-release/webkit-home-430x932.png output/playwright/v3-release/webkit-home-1440x900.png output/playwright/v3-release/chromium-home-320x568.png output/playwright/v3-release/chromium-home-390x844.png output/playwright/v3-release/chromium-home-430x932.png output/playwright/v3-release/chromium-home-1440x900.png
git commit -m "release: Wildz v3.0.0"
```

Every listed doctrine file must receive a concise v3.0.0 qualification note that states its proven authority boundary and whether its operator capability was invoked. Include any additional sanitized screenshot explicitly by path; never use `git add .`.

- [ ] **Step 21: Verify the release commit and stop**

```bash
git status --short
git log -1 --oneline
git show --stat --oneline HEAD
```

Expected: worktree is clean; latest commit is `release: Wildz v3.0.0`; only intended release files and sanitized evidence appear. Do not tag or push.

## Release Blocking Conditions

Do not create the final commit when any condition below is true:

- strict-live SDK doctor is missing an environment requirement or required capability;
- a private/live Vault does not activate its exact embedded username or does not preserve it after cold relaunch in either engine;
- either engine's sorted unique rendered card set differs from the complete verified Vault set before or after relaunch;
- any named official/source writer is missing, lacks verifiable non-private provenance, fails import, loses a unique Wildz card, or admits an unrelated domain as a card;
- either engine's Wildz export fails official SDK identity reading or source V3/card verification;
- either engine cannot horizontally scroll the complete rail, cannot reach every Card Vault page, or differs from a source-computed rarity/newest/oldest order;
- configured market is not authoritative, unconfigured market does not fail closed, or a live mutation occurred during qualification;
- any direct auth/world/card/profile/market read probe fails its safe schema or the world response is not exactly one `{ ok, projection, mode }` layer;
- authentication, world, market, Receiz, artifact proxy, or mutation traffic is found in a cache;
- install or update occurs without explicit consent, state preservation does not fire, or a worker skips waiting during install;
- a modal leaks focus, fails permitted Escape dismissal, or restores the wrong trigger;
- a visible target is smaller than 44 by 44 CSS pixels at any required size, keyboard scan fails, or browser zoom is disabled;
- detailed renderer caps exceed two ecology, one boss, or two supports; diagnostics poll in production; WebGL loss resets canonical state or requires page reload;
- either WebKit or Chromium is missing a required viewport/desktop run, FCP or first-visible Wildz exceeds 5 seconds, initially loaded JavaScript exceeds 2,000,000 bytes, or either desktop engine fails renderer diagnostics;
- a browser console error, security-header failure, build/test/type/lint/secret-scan failure, or unsanitized evidence remains;
- AI/MCP/release documentation asserts behavior that the final evidence did not establish.

## Final Completion Gate

The plan is complete only when Task 6 creates the final commit on `main`, `git status --short` is empty, all private artifacts remain outside the repository, and the user retains sole responsibility for any tag, push, deployment, or live mutation.
