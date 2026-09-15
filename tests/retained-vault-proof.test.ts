import { admittedInventoryDiagnostics } from "../src/features/play/admitted-inventory";
import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalPortableCardJson, sealCollectedCard } from "../src/features/play/portable-card";
import { initialPlayState } from "../src/features/play/game-state";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { createRetainedProofJson, freezeProofValue } from "../src/features/play/retained-proof-json";
import { createRetainedPortableVaultWriter, embedPortableVaultInPng, withPreparedPortableVaultPng, readWildzPlayerVaultAppendFromPng } from "../src/features/play/card-export";
import { createWildzIdentityBoundPreparedVault } from "../src/lib/receiz/wildz-identity-vault-binding";
import { createReceizIdentityKeyFile } from "@receiz/sdk";
import { requireWildzIdentityBindingFromEnvelope } from "../src/lib/receiz/wildz-identity-binding";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
const card = (id: string) => sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: id, capturedAt: "2026-09-15T00:00:00.000Z" });
const inputFor = (inventory: ReturnType<typeof card>[]) => ({ playerId: "keeper", exportedAt: "2026-09-15T00:00:00.000Z", playState: { ...initialPlayState, inventory }, settings: { avatarStyle: null, movementMode: "walk" as const, audio: {} }, personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3" as const, revision: 0, eventId: null }, receipts: [] });

test("retained canonical proof representation is byte-identical and never retains mutable caller data", () => {
  const serialize = createRetainedProofJson();
  const mutable = { value: { count: 1 }, omitted: undefined, entries: [undefined, null, -0], 12: "b", 2: "a", "a!": true, A: 7 };
  assert.equal(serialize(mutable), canonicalPortableCardJson(mutable));
  Object.freeze(mutable);
  mutable.value.count = 2;
  assert.equal(serialize(mutable), canonicalPortableCardJson(mutable));
  freezeProofValue(mutable);
  assert.throws(() => { mutable.value.count = 3; }, TypeError);
  assert.equal(serialize(mutable), canonicalPortableCardJson(mutable));
});

test("unchanged proof sections survive new history; only additions acquire new sections", () => {
  const writer = createRetainedPortableVaultWriter();
  const first = card("first"), second = card("second");
  const initial = inputFor([first, second]);
  const capture = (input: Parameters<typeof writer.prepare>[2]) => {
    const { prepared } = writer.prepare(png, input.playState.inventory, input);
    return withPreparedPortableVaultPng(prepared, contents => contents.bytes);
  };
  assert.deepEqual(capture(initial), embedPortableVaultInPng(png, initial.playState.inventory, createWildsPlayerVault(initial)));
  assert.equal(writer.diagnostics().cardSectionsPrepared, 2);
  const history = { ...initial, playState: { ...initial.playState, player: { x: 17, z: -2 } }, personalEvents: [{ eventId: "event-one", kind: "harvest", occurredAt: "2026-09-15T00:00:01.000Z" }] };
  const admissionsBeforeHistory = admittedInventoryDiagnostics().verifierCalls;
  const updated = capture(history);
  assert.equal(admittedInventoryDiagnostics().verifierCalls, admissionsBeforeHistory);
  assert.deepEqual(updated, embedPortableVaultInPng(png, history.playState.inventory, createWildsPlayerVault(history)));
  assert.deepEqual(readWildzPlayerVaultAppendFromPng(updated).player.personalEvents, history.personalEvents);
  assert.equal(writer.diagnostics().cardSectionsPrepared, 2);
  const third = card("third");
  capture({ ...history, playState: { ...history.playState, inventory: [first, second, third] } });
  assert.equal(writer.diagnostics().cardSectionsPrepared, 3);
  capture({ ...history, playState: { ...history.playState, inventory: [third, first] } });
  assert.equal(writer.diagnostics().cardSectionsPrepared, 3);
  const invalid = structuredClone(first); invalid.manifest.name = "tampered";
  assert.throws(() => capture(inputFor([invalid])), /cards_invalid/);
});

test("only writer-owned exact bytes can use prepared signing and custody is single-use", async () => {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "retained-vault", username: "keeper" } });
  const writer = createRetainedPortableVaultWriter(), input = inputFor([card("sign")]);
  const { prepared } = writer.prepare(png, input.playState.inventory, input);
  const bytes = await createWildzIdentityBoundPreparedVault({ keyFile, prepared });
  assert.equal((await requireWildzIdentityBindingFromEnvelope(bytes)).keyId, keyFile.keyId);
  assert.throws(() => createWildzIdentityBoundPreparedVault({ keyFile, prepared }), /custody_missing/);
  assert.throws(() => createWildzIdentityBoundPreparedVault({ keyFile, prepared: { kind: "wildz.prepared-vault-png" } }), /custody_missing/);
});
