import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const root = resolve(process.cwd(), ".test-build");

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : path.endsWith(".js") ? [path] : [];
  });
}

function patchSpecifier(file, specifier) {
  if (!specifier.startsWith(".")) return specifier;
  if (extname(specifier)) return specifier;

  const candidate = resolve(dirname(file), `${specifier}.js`);
  return existsSync(candidate) ? `${specifier}.js` : specifier;
}

for (const file of files(root)) {
  const original = readFileSync(file, "utf8");
  const patched = original
    .replace(
      /(from\s+["'])(\.[^"']+)(["'])/g,
      (_match, prefix, specifier, suffix) => `${prefix}${patchSpecifier(file, specifier)}${suffix}`
    )
    .replace(
      /(import\s+["'])(\.[^"']+)(["'])/g,
      (_match, prefix, specifier, suffix) => `${prefix}${patchSpecifier(file, specifier)}${suffix}`
    )
    .replace(
      /(import\(\s*["'])(\.[^"']+)(["']\s*\))/g,
      (_match, prefix, specifier, suffix) => `${prefix}${patchSpecifier(file, specifier)}${suffix}`
    );

  if (patched !== original) {
    writeFileSync(file, patched);
  }
}
