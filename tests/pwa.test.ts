import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("PWA manifest is standalone and fully Wildz branded", () => { const source = readFileSync("app/manifest.ts", "utf8"); assert.match(source, /name:\s*WILDZ_PRODUCT\.name/); assert.match(source, /display:\s*"standalone"/); assert.match(source, /start_url:\s*"\/"/); assert.match(source, /purpose:\s*"maskable"/); });
test("service worker never caches identity or market mutation APIs", () => { const source = readFileSync("public/sw.js", "utf8"); assert.match(source, /request\.method !== "GET"/); assert.match(source, /\/api\//); assert.doesNotMatch(source, /caches\.put\(request[\s\S]*market/); });
