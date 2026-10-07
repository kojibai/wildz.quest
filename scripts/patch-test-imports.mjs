import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const root = resolve(process.cwd(), ".test-build");

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : path.endsWith(".js") ? [path] : [];
  });
}

function patchSpecifier(file, specifier) {
  if (specifier.startsWith("@/")) {
    const candidate = resolve(root, "src", `${specifier.slice(2)}.js`);
    if (!existsSync(candidate)) return specifier;
    const path = relative(dirname(file), candidate).split(sep).join("/");
    return path.startsWith(".") ? path : `./${path}`;
  }
  if (!specifier.startsWith(".")) return specifier;
  // Node's SSR tests do not run Next's CSS loader. Keep module class names
  // available while rendering the actual component and its controls.
  if (specifier.endsWith('.module.css')) {
    const target = resolve(dirname(file), specifier);
    const source = resolve(process.cwd(), relative(root, target));
    const classes = Object.fromEntries([...readFileSync(source, 'utf8').matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1], match[1]]));
    writeFileSync(`${target}.js`, `export default Object.freeze(${JSON.stringify(classes)});\n`);
    return `${specifier}.js`;
  }
  if (extname(specifier)) return specifier;

  const candidate = resolve(dirname(file), `${specifier}.js`);
  return existsSync(candidate) ? `${specifier}.js` : specifier;
}

for (const file of files(root)) {
  const original = readFileSync(file, "utf8");
  const patched = original
    .replaceAll('import "server-only";', "")
    .replaceAll("import 'server-only';", "")
    .replaceAll('"next/server"', '"next/server.js"')
    .replaceAll("'next/server'", "'next/server.js'")
    .replaceAll('"next/link"', '"next/link.js"')
    .replaceAll("'next/link'", "'next/link.js'")
    .replaceAll('"next/image"', '"next/image.js"')
    .replaceAll("'next/image'", "'next/image.js'")
    .replace(
      /(from\s+["'])((?:\.|@\/)[^"']+)(["'])/g,
      (_match, prefix, specifier, suffix) => `${prefix}${patchSpecifier(file, specifier)}${suffix}`
    )
    .replace(
      /(import\s+["'])((?:\.|@\/)[^"']+)(["'])/g,
      (_match, prefix, specifier, suffix) => `${prefix}${patchSpecifier(file, specifier)}${suffix}`
    )
    .replace(
      /(import\(\s*["'])((?:\.|@\/)[^"']+)(["']\s*\))/g,
      (_match, prefix, specifier, suffix) => `${prefix}${patchSpecifier(file, specifier)}${suffix}`
    );

  if (patched !== original) {
    writeFileSync(file, patched);
  }
}
