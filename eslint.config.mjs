import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: __dirname
});

const eslintConfig = [
  {
    ignores: ["src/lib/receiz/local-seal/reference/**", "public/snarkjs.min.js", ".next/**", ".test-build/**", ".worktrees/**", "output/**", ".playwright-cli/**", ".superpowers/**", "node_modules/**", "out/**", "dist/**", "next-env.d.ts"]
  },
  ...compat.extends("next/core-web-vitals")
];

export default eslintConfig;
