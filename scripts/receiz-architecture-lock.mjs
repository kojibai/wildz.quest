#!/usr/bin/env node
import { access, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
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
const localVoice = await read("src/features/play/local-neural-voice.ts");
const localVoiceWorker = await read("src/features/play/local-neural-voice.worker.ts");
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
const v121VoiceRequest = await read("docs/RECEIZ_V121_OFFLINE_VOICE_REQUEST.md");
const offlineVoiceDecision = await read("docs/receiz-decisions/2026-08-17-offline-acoustic-renderer.md");

if (pkg.dependencies?.["@receiz/sdk"] !== "121.0.0") failures.push("receiz_sdk_pin_mismatch");
if (pkg.devDependencies?.["@receiz/mcp-server"] !== "121.0.0") failures.push("receiz_mcp_pin_mismatch");
if (pkg.devDependencies?.["@receiz/ai-skills"] !== "121.0.0") failures.push("receiz_ai_skills_pin_mismatch");
if (pkg.scripts?.["receiz:architecture-lock"] !== "node scripts/receiz-architecture-lock.mjs") {
  failures.push("receiz_architecture_lock_script_unwired");
}
requireMatch(releaseCheck, /run\(["']pnpm["'], \[["']receiz:architecture-lock["']\]\)/, "receiz_architecture_lock_release_gate_missing");
requireMatch(continuousIntegration, /pnpm release:check/, "receiz_architecture_lock_ci_gate_missing");

const allDependencies = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
for (const dependency of Object.keys(allDependencies)) {
  if (/elevenlabs|speech[-_]?synthesis/i.test(dependency)) {
    failures.push(`forbidden_voice_dependency:${dependency}`);
  }
}
if (pkg.dependencies?.["kokoro-js"] !== "1.2.1") failures.push("offline_voice_kokoro_pin_mismatch");
if (pkg.dependencies?.["@huggingface/transformers"] !== "3.8.1") failures.push("offline_voice_transformers_pin_mismatch");

const runtimePaths = ["app", "src"];
const runtimeFiles = (await Promise.all(runtimePaths.map(sourceFiles))).flat();
const forbiddenRuntime = /RECEIZ_CREATURE_VOICE_API_KEY|RECEIZ_CREATURE_TWIN_HANDLE|creature-voice\/session|speechSynthesis|@xenova|elevenlabs|new\s+WebSocket|world\.streamProfile|reply_preview|localCreatureTwinReply/i;
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

requireMatch(route, /observeCreatureThroughReceizV120\(/, "local_v120_subject_twin_missing");
requireMatch(route, /proofGroundedCreatureReply\(subjectBrain, input\.message, presentKaiMoment\.temporalRoot\.uPulse\)/, "proof_grounded_intelligence_missing");
requireMatch(route, /type:\s*["']reply_reset["']/, "immediate_proof_reply_missing");
requireMatch(route, /receiz\.world\.message\(["']wildz["']/, "optional_twin_enrichment_rail_missing");
requireMatch(route, /PERFORMANCE_ENRICHMENT_BUDGET_MS/, "enrichment_budget_missing");
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
requireMatch(playback, /synthesizeProofVoice\(/, "local_proof_voice_missing");
requireMatch(playback, /VOWEL_FORMANTS/, "human_vocal_tract_formants_missing");
requireMatch(playback, /birthMomentMs/, "birth_moment_voice_identity_missing");
requireMatch(playback, /speakingMoment\.uPulse/, "speaking_moment_prosody_missing");
requireMatch(playback, /KAI_PULSE_DURATION_MS/, "canonical_kai_breath_period_missing");
requireMatch(playback, /KAI_BREATH_INHALE_SHARE/, "canonical_fibonacci_breath_split_missing");
requireMatch(playback, /one complete Golden breath/i, "kai_pulse_breath_law_missing");
requireMatch(playback, /receiz-proof-source-filter/, "proof_voice_engine_missing");
requireMatch(playback, /receiz-proof-neural-offline/, "offline_neural_voice_engine_missing");
requireMatch(localVoice, /new Worker\(new URL\(/, "offline_voice_worker_boundary_missing");
requireMatch(localVoiceWorker, /allowRemoteModels\s*=\s*false/, "offline_voice_remote_loading_enabled");
requireMatch(localVoiceWorker, /numThreads\s*=\s*1/, "offline_voice_thread_budget_missing");
requireMatch(localVoiceWorker, /device:\s*["']wasm["']/, "offline_voice_wasm_path_missing");
forbidMatch(localVoiceWorker, /fetch\(["'`]https?:\/\//, "offline_voice_remote_fetch_present");
requireMatch(offlineVoiceDecision, /Status: approved/, "offline_voice_gap_not_approved");
requireMatch(offlineVoiceDecision, /SDK inventory performed first/, "offline_voice_sdk_inventory_missing");
requireMatch(offlineVoiceDecision, /MCP inventory performed second/, "offline_voice_mcp_inventory_missing");
requireMatch(offlineVoiceDecision, /AI-skill doctrine performed third/, "offline_voice_skill_inventory_missing");
forbidMatch(panel, /unique neural voice could not play|No substitute voice|enrichment unavailable/i, "player_visible_voice_degradation");
const appendIndex = panel.indexOf("onObserved(result.turn)");
const playbackResultIndex = panel.indexOf("voiceStream.completed.then");
if (appendIndex < 0 || playbackResultIndex < 0 || appendIndex > playbackResultIndex) {
  failures.push("voice_precedes_or_gates_proof_memory_append");
}

const doctrine = [builderSkill, releaseSkill, marketSkill, contributing, pullRequestTemplate, receizFirstLaw, gapTemplate, voiceContract, postmortem, v121VoiceRequest].join("\n");
for (const [name, source] of Object.entries({ builderSkill, releaseSkill, marketSkill, contributing, pullRequestTemplate, receizFirstLaw, gapTemplate })) {
  requireMatch(source, /SDK[\s\S]{0,240}(?:first|inventory)[\s\S]{0,300}MCP[\s\S]{0,300}AI[- ]skills?/i, `receiz_first_reasoning_order_missing:${name}`);
}
requireMatch(receizFirstLaw, /Custom infrastructure[\s\S]{0,220}(?:only|blocked)[\s\S]{0,260}capability gap/i, "capability_gap_law_missing");
requireMatch(gapTemplate, /SDK inventory performed first/i, "capability_gap_sdk_evidence_missing");
requireMatch(gapTemplate, /MCP inventory performed second/i, "capability_gap_mcp_evidence_missing");
requireMatch(gapTemplate, /AI-skill doctrine performed third/i, "capability_gap_ai_skill_evidence_missing");
requireMatch(pullRequestTemplate, /Receiz-first reasoning record/i, "receiz_first_pr_gate_missing");
requireMatch(doctrine, /local[\s\S]{0,160}proof[\s\S]{0,160}(?:voice|intelligence)/i, "local_proof_twin_doctrine_missing");
requireMatch(doctrine, /proof object remains (?:the )?(?:strongest )?authority/i, "proof_authority_doctrine_missing");
requireMatch(doctrine, /server (?:is|remains) (?:only )?(?:transport|observer)/i, "server_boundary_doctrine_missing");
requireMatch(doctrine, /voice[\s\S]{0,100}(?:never|cannot)[\s\S]{0,100}(?:gate|block)[\s\S]{0,100}(?:memory|append)/i, "voice_memory_independence_doctrine_missing");
requireMatch(postmortem, /implementation reasoning deviated/i, "reasoning_postmortem_missing");

const payloadRoot = join(root, "public/models/onnx-community/Kokoro-82M-v1.0-ONNX");
const payloadManifest = JSON.parse(await readFile(join(payloadRoot, "wildz-manifest.json"), "utf8"));
if (payloadManifest.upstream?.revision !== "1939ad2a8e416c0acfeecc08a694d14ef25f2231") {
  failures.push("offline_voice_upstream_revision_mismatch");
}
for (const [file, expectedDigest] of Object.entries(payloadManifest.files ?? {})) {
  const bytes = await readFile(join(payloadRoot, file));
  const actualDigest = createHash("sha256").update(bytes).digest("hex");
  if (actualDigest !== expectedDigest) failures.push(`offline_voice_payload_digest_mismatch:${file}`);
}
for (const [file, expectedDigest] of Object.entries(payloadManifest.runtimeFiles ?? {})) {
  const bytes = await readFile(join(root, "public", file));
  const actualDigest = createHash("sha256").update(bytes).digest("hex");
  if (actualDigest !== expectedDigest) failures.push(`offline_voice_runtime_digest_mismatch:${file}`);
}

if (failures.length) {
  process.stderr.write(`Receiz architecture lock failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`Receiz architecture lock passed (${runtimeFiles.length} runtime files checked).\n`);
