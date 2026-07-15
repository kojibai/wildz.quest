import { readFile } from "node:fs/promises";
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const present = (name) => Boolean(process.env[name]);
const report = { product: "Wildz", sdk: pkg.dependencies["@receiz/sdk"], mcpCompatibility: "100.0.0", capabilities: { identity: "local-available", identityArtifacts: "local-available", portableProofs: "local-available", liveApi: present("RECEIZ_ACCESS_TOKEN") ? "configured" : "needs-env", checkout: present("RECEIZ_ACCESS_TOKEN") ? "configured" : "needs-env", webhooks: present("RECEIZ_WEBHOOK_SECRET") ? "configured" : "needs-env" } };
console.log(JSON.stringify(report, null, 2));
