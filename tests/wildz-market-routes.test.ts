import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("market remains embedded and exposes bounded command routes", () => {
  assert.equal(existsSync("app/market/page.tsx"), false);
  for (const route of ["listings", "offers", "trades", "checkout"]) {
    const source = readFileSync(`app/api/market/${route}/route.ts`, "utf8");
    assert.match(source, /NextResponse/);
    assert.match(source, /idempotency/i);
  }
});
