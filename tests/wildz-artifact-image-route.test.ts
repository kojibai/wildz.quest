import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/wildz/artifact-image/route";
import { initialPlayState } from "../src/features/play/game-state";

test("Safari fallback rasterizes a verified exact card and Vault to real PNG bytes", async () => {
  for (const kind of ["card", "vault"] as const) {
    const request = new Request("https://wildz.quest/api/wildz/artifact-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, assets: [initialPlayState.inventory[0]!] })
    });
    const response = await POST(request as never);
    if (response.status !== 200) assert.fail(await response.text());
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(response.headers.get("x-wildz-raster-authority"), "verified-card-projection");
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(bytes.byteLength > 1_000);
  }
});

test("Safari fallback rejects an unverified card before rendering", async () => {
  const tampered = structuredClone(initialPlayState.inventory[0]!);
  tampered.manifest.name = "Tampered";
  const response = await POST(new Request("https://wildz.quest/api/wildz/artifact-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "card", assets: [tampered] })
  }) as never);
  assert.equal(response.status, 422);
});
