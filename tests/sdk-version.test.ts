import assert from "node:assert/strict"; import { readFileSync } from "node:fs"; import { test } from "node:test";
test("SDK and MCP compatibility majors match", () => { const pkg = JSON.parse(readFileSync("package.json","utf8")); const docs = readFileSync("docs/MCP.md","utf8"); assert.match(pkg.dependencies["@receiz/sdk"],/100\.0\.0/); assert.match(docs,/@receiz\/mcp-server@100\.0\.0/); });
