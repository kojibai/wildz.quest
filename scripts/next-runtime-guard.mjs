#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const mode = process.argv[2];
const passthroughArgs = process.argv.slice(3);
const workspaceCwd = resolve(process.cwd());
const markerFile = resolve(
  process.env.RECEIZ_NEXT_RUNTIME_MARKER ?? join(workspaceCwd, "tmp", "receiz-next-runtime.json")
);
const guardedModes = new Set(["dev", "build", "start"]);

function readMarker() {
  if (!existsSync(markerFile)) return null;

  try {
    const marker = JSON.parse(readFileSync(markerFile, "utf8"));
    return marker && typeof marker === "object" ? marker : null;
  } catch {
    removeMarker();
    return null;
  }
}

function removeMarker() {
  rmSync(markerFile, { force: true });
}

function pidIsActive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && typeof error === "object" && "code" in error && error.code === "EPERM");
  }
}

function activeMarker() {
  const marker = readMarker();
  if (!marker) return null;

  if (marker.cwd && resolve(String(marker.cwd)) !== workspaceCwd) {
    return null;
  }

  if (pidIsActive(Number(marker.pid))) {
    return marker;
  }

  removeMarker();
  return null;
}

function conflictMessage(marker) {
  const activeMode = typeof marker.mode === "string" ? marker.mode : "runtime";
  const pid = Number.isInteger(Number(marker.pid)) ? ` pid ${marker.pid}` : "";

  if (activeMode === "build") {
    return `A guarded Next build is already running for this workspace${pid}. Wait for it to finish before running another Next command.`;
  }

  return `A guarded Next ${activeMode} runtime is active for this workspace${pid}. Stop \`pnpm dev\` or \`pnpm start\` before running \`pnpm build\` or \`pnpm release:check\`.`;
}

function assertIdle() {
  const marker = activeMarker();
  if (!marker) return true;

  console.error(conflictMessage(marker));
  return false;
}

function writeMarker(nextMode) {
  mkdirSync(dirname(markerFile), { recursive: true });
  writeFileSync(
    markerFile,
    JSON.stringify(
      {
        command: `next ${nextMode}${passthroughArgs.length ? ` ${passthroughArgs.join(" ")}` : ""}`,
        cwd: workspaceCwd,
        mode: nextMode,
        pid: process.pid,
        startedAt: new Date().toISOString()
      },
      null,
      2
    )
  );
}

function cleanupOwnMarker() {
  const marker = readMarker();
  if (marker && Number(marker.pid) === process.pid) {
    removeMarker();
  }
}

function nextBinary() {
  return join(workspaceCwd, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
}

if (mode === "assert-idle") {
  process.exit(assertIdle() ? 0 : 1);
}

if (!guardedModes.has(String(mode))) {
  console.error("Usage: node scripts/next-runtime-guard.mjs <dev|build|start|assert-idle> [...next args]");
  process.exit(1);
}

if (!assertIdle()) {
  process.exit(1);
}

writeMarker(String(mode));

let child = null;
const finish = (status) => {
  cleanupOwnMarker();
  process.exit(status ?? 1);
};

child = spawn(nextBinary(), [String(mode), ...passthroughArgs], {
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit"
});

child.on("error", (error) => {
  cleanupOwnMarker();
  console.error(error instanceof Error ? error.message : "Failed to run Next.js command.");
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    cleanupOwnMarker();
    process.kill(process.pid, signal);
    return;
  }

  finish(code);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (child && !child.killed) {
      child.kill(signal);
    }
    cleanupOwnMarker();
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}
