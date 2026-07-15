import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
test("PWA controller registers after paint and asks before updating", () => { const source = readFileSync("src/features/pwa/PwaController.tsx", "utf8"); assert.match(source, /serviceWorker\.register/); assert.match(source, /requestIdleCallback|setTimeout/); assert.match(source, /Update ready/); assert.doesNotMatch(source, /location\.reload\(\)/); });
