#!/usr/bin/env node
import { access, readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const failures = [];

async function read(path) {
  return readFile(join(root, path), "utf8");
}

function requireMatch(source, pattern, code) {
  if (!pattern.test(source)) failures.push(code);
}

function forbidMatch(source, pattern, code) {
  if (pattern.test(source)) failures.push(code);
}

async function sourceFiles(directory) {
  const files = [];
  const walk = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) files.push(path);
    }
  };
  await walk(join(root, directory));
  return files;
}

const pkg = JSON.parse(await read("package.json"));
const envExample = await read(".env.example");
const releaseCheck = await read("scripts/release-check.mjs");
const continuousIntegration = await read(".github/workflows/ci.yml");
const route = await read("app/api/receiz/creature-observer/route.ts");
const panel = await read("src/features/play/CreatureConsciousnessPanel.tsx");
const playback = await read("src/features/play/creature-voice-playback.ts");
const subject = await read("src/features/play/receiz-v120-creature-subject.ts");
const consciousness = await read("src/features/play/creature-consciousness.ts");
const builderSkill = await read("ai-skills/wildz-builder-skill/SKILL.md");
const releaseSkill = await read("ai-skills/wildz-release-skill/SKILL.md");
const marketSkill = await read("ai-skills/wildz-market-operator-skill/SKILL.md");
const contributing = await read("CONTRIBUTING.md");
const pullRequestTemplate = await read(".github/PULL_REQUEST_TEMPLATE.md");
const receizFirstLaw = await read("docs/RECEIZ_FIRST_ENGINEERING.md");
const gapTemplate = await read("docs/receiz-decisions/TEMPLATE.md");
const voiceContract = await read("docs/RECEIZ_V120_CREATURE_VOICE.md");
const postmortem = await read("docs/release/v6.1.0-reasoning-postmortem.md");

if (pkg.dependencies?.["@receiz/sdk"] !== "120.0.0") failures.push("receiz_sdk_pin_mismatch");
if (pkg.devDependencies?.["@receiz/mcp-server"] !== "120.0.0") failures.push("receiz_mcp_pin_mismatch");
if (pkg.devDependencies?.["@receiz/ai-skills"] !== "120.0.0") failures.push("receiz_ai_skills_pin_mismatch");
if (pkg.scripts?.["receiz:architecture-lock"] !== "node scripts/receiz-architecture-lock.mjs") {
  failures.push("receiz_architecture_lock_script_unwired");
}
requireMatch(releaseCheck, /run\(["']pnpm["'], \[["']receiz:architecture-lock["']\]\)/, "receiz_architecture_lock_release_gate_missing");
requireMatch(continuousIntegration, /pnpm release:check/, "receiz_architecture_lock_ci_gate_missing");

const allDependencies = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
for (const dependency of Object.keys(allDependencies)) {
  if (/elevenlabs|kokoro|onnx|transformers|speech[-_]?synthesis/i.test(dependency)) {
    failures.push(`forbidden_voice_dependency:${dependency}`);
  }
}

const runtimePaths = ["app", "src"];
const runtimeFiles = (await Promise.all(runtimePaths.map(sourceFiles))).flat();
const forbiddenRuntime = /RECEIZ_CREATURE_VOICE_API_KEY|RECEIZ_CREATURE_TWIN_HANDLE|creature-voice\/session|speechSynthesis|onnxruntime|@xenova|transformers(?:\.js)?|kokoro|elevenlabs|new\s+WebSocket|world\.streamProfile|reply_preview|localCreatureTwinReply/i;
for (const path of runtimeFiles) {
  const source = await readFile(path, "utf8");
  if (forbiddenRuntime.test(source)) failures.push(`forbidden_voice_runtime:${relative(root, path)}`);
  if (/from\s+["']@receiz\/(?:mcp-server|ai-skills)/.test(source)) {
    failures.push(`tooling_imported_into_runtime:${relative(root, path)}`);
  }
}
forbidMatch(envExample, /RECEIZ_CREATURE_(?:VOICE|TWIN)/, "forbidden_voice_environment");
try {
  await access(join(root, "app/api/receiz/creature-voice/session/route.ts"));
  failures.push("provider_voice_session_route_present");
} catch { /* Required absence. */ }

requireMatch(route, /receiz\.subjects\.twin\.streamPerformance\(input\.card\.id/, "subject_performance_sdk_rail_missing");
requireMatch(route, /contextHead:\s*proofContext\.head\.subjectHead/, "live_subject_head_binding_missing");
requireMatch(route, /expectedSubjectDigest:\s*proofContext\.head\.subjectDigest/, "subject_digest_binding_missing");
requireMatch(route, /responseMode:\s*["']performance["']/, "subject_performance_mode_missing");
requireMatch(route, /event\.type === ["']reply_delta["']/, "typed_reply_delta_missing");
requireMatch(route, /event\.type === ["']audio_chunk["']/, "typed_audio_chunk_missing");
requireMatch(route, /event\.type === ["']reply_done["']/, "typed_reply_completion_missing");
requireMatch(route, /createObservedCreatureTurn\(/, "proof_memory_turn_missing");
forbidMatch(route, /if\s*\(\s*!audioSent\s*\)|generatedAudio\s*===\s*true[\s\S]{0,160}createObservedCreatureTurn/, "voice_gates_proof_memory");

requireMatch(subject, /createReceizLivingSubjectRuntime\(/, "v120_subject_runtime_missing");
requireMatch(subject, /runtime\.admitSubject\(/, "exact_subject_admission_missing");
requireMatch(subject, /runtime\.subjects\.twin\.message\(/, "proof_twin_observation_missing");
forbidMatch(subject, /projectCreatureBrain\(/, "duplicate_subject_brain_projection");
requireMatch(consciousness, /verifyAnyWildsCard\(record\.card as PortableCardAsset\)\.ok/, "request_proof_verification_missing");
requireMatch(route, /projectVerifiedCreatureBrain\(input\.card\)/, "verified_brain_reuse_missing");

requireMatch(playback, /decodeAudioData\(/, "native_audio_decode_missing");
requireMatch(playback, /getByteTimeDomainData\(/, "waveform_mouth_sync_missing");
requireMatch(playback, /chunk\.voiceSignature[^\n]*neural\.signature/, "proof_voice_signature_check_missing");
const appendIndex = panel.indexOf("onObserved(result.turn)");
const playbackResultIndex = panel.indexOf("voiceStream.completed.then");
if (appendIndex < 0 || playbackResultIndex < 0 || appendIndex > playbackResultIndex) {
  failures.push("voice_precedes_or_gates_proof_memory_append");
}

const doctrine = [builderSkill, releaseSkill, marketSkill, contributing, pullRequestTemplate, receizFirstLaw, gapTemplate, voiceContract, postmortem].join("\n");
for (const [name, source] of Object.entries({ builderSkill, releaseSkill, marketSkill, contributing, pullRequestTemplate, receizFirstLaw, gapTemplate })) {
  requireMatch(source, /SDK[\s\S]{0,240}(?:first|inventory)[\s\S]{0,300}MCP[\s\S]{0,300}AI[- ]skills?/i, `receiz_first_reasoning_order_missing:${name}`);
}
requireMatch(receizFirstLaw, /Custom infrastructure[\s\S]{0,220}(?:only|blocked)[\s\S]{0,260}capability gap/i, "capability_gap_law_missing");
requireMatch(gapTemplate, /SDK inventory performed first/i, "capability_gap_sdk_evidence_missing");
requireMatch(gapTemplate, /MCP inventory performed second/i, "capability_gap_mcp_evidence_missing");
requireMatch(gapTemplate, /AI-skill doctrine performed third/i, "capability_gap_ai_skill_evidence_missing");
requireMatch(pullRequestTemplate, /Receiz-first reasoning record/i, "receiz_first_pr_gate_missing");
requireMatch(doctrine, /subjects\.twin\.streamPerformance/, "sdk_voice_doctrine_missing");
requireMatch(doctrine, /proof object remains (?:the )?(?:strongest )?authority/i, "proof_authority_doctrine_missing");
requireMatch(doctrine, /server (?:is|remains) (?:only )?(?:transport|observer)/i, "server_boundary_doctrine_missing");
requireMatch(doctrine, /voice[\s\S]{0,100}(?:never|cannot)[\s\S]{0,100}(?:gate|block)[\s\S]{0,100}(?:memory|append)/i, "voice_memory_independence_doctrine_missing");
requireMatch(postmortem, /implementation reasoning deviated/i, "reasoning_postmortem_missing");

if (failures.length) {
  process.stderr.write(`Receiz architecture lock failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`Receiz architecture lock passed (${runtimeFiles.length} runtime files checked).\n`);
