import { dirname, resolve } from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const kokoroVirtualNodeModules = dirname(realpathSync(resolve(root, "node_modules/kokoro-js")));
const transformersRoot = realpathSync(resolve(kokoroVirtualNodeModules, "@huggingface/transformers"));
const transformersVirtualNodeModules = dirname(dirname(transformersRoot));
const onnxWebDist = resolve(transformersVirtualNodeModules, "onnxruntime-web/dist");
const transformersWeb = resolve(transformersRoot, "dist/transformers.web.js");

export function contentSecurityPolicy(environment) {
  const scripts = environment === "development"
    ? "script-src 'self' blob: 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
    : "script-src 'self' blob: 'unsafe-inline' 'wasm-unsafe-eval'";
  return `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https:; ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' blob:`;
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy(process.env.NODE_ENV === "development" ? "development" : "production")
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()"
  },
  {
    key: "Referrer-Policy",
    value: "no-referrer"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin"
  },
  {
    // ONNX Runtime's threaded WASM build requires a cross-origin-isolated
    // document. Its model and voice fetches already use CORS-aware requests.
    key: "Cross-Origin-Embedder-Policy",
    value: "require-corp"
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none"
  }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: root,
  outputFileTracingExcludes: {
    "/*": [
      ".git/**/*",
      ".playwright-cli/**/*",
      ".pnpm-store/**/*",
      ".test-build/**/*",
      ".worktrees/**/*",
      "ai-skills/**/*",
      "docs/**/*",
      "output/**/*",
      "tests/**/*",
      "tmp/**/*",
      "vendor/**/*"
    ]
  },
  reactStrictMode: true,
  webpack(config, { isServer, webpack }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Bundle Kokoro's ESM entry with its browser fallbacks. The pre-bundled
      // web file strips ONNX Runtime's webpackIgnore marker, causing WebKit's
      // runtime-module import to become an unresolvable webpack context.
      "kokoro-js": resolve(root, "node_modules/kokoro-js/dist/kokoro.js"),
      "@huggingface/transformers": transformersWeb,
      "ort.bundle.min.mjs$": resolve(onnxWebDist, "ort.bundle.min.mjs"),
      "ort-wasm-simd-threaded.jsep.wasm$": resolve(onnxWebDist, "ort-wasm-simd-threaded.jsep.wasm")
    };
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^ort\.bundle\.min\.mjs$/, resolve(onnxWebDist, "ort.bundle.min.mjs")),
      new webpack.NormalModuleReplacementPlugin(/^ort-wasm-simd-threaded\.jsep\.wasm$/, resolve(onnxWebDist, "ort-wasm-simd-threaded.jsep.wasm"))
    );
    config.module.rules.push({
      test: /ort-wasm-simd-threaded\.jsep\.wasm$/,
      type: "asset/resource"
    });
    if (!isServer) {
      // SDK v119 exposes its Node-only compilers through @receiz/sdk/compiler.
      // Keep those unused compiler built-ins outside client bundles until the
      // package publishes a dedicated browser export condition.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.slice("node:".length);
        })
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        assert: false,
        "assert/strict": false,
        crypto: false,
        fs: false,
        "fs/promises": false,
        path: false,
        test: false
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate"
          },
          {
            key: "Service-Worker-Allowed",
            value: "/"
          }
        ]
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
