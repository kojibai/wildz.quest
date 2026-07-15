import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const textFiles = files.filter((file) => !/\.(png|jpe?g|gif|webp|woff2?|ico|pdf)$/i.test(file));
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk|rk)_(?:live|prod)_[A-Za-z0-9_-]{12,}/,
  /\bBearer\s+[A-Za-z0-9_-]{24,}/,
  /^(?:RECEIZ_ACCESS_TOKEN|RECEIZ_CLIENT_SECRET|RECEIZ_WEBHOOK_SECRET)=[^\s#]+/m
];
const failures = [];
for (const file of textFiles) {
  const source = readFileSync(file, "utf8");
  if (patterns.some((pattern) => pattern.test(source))) failures.push(file);
}
if (failures.length) {
  console.error(`Secret scan failed in ${failures.length} file(s): ${failures.join(", ")}`);
  process.exit(1);
}
console.log(`Secret scan passed (${textFiles.length} text files checked; values were not printed).`);
