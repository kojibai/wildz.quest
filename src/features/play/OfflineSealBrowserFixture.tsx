"use client";

import { useState } from "react";
import { appendReceizIdentityArtifactTrailerToPng, createReceizIdentityKeyFile, sha256ReceizBytes, verifyReceizArtifact } from "@receiz/sdk";
import { readWildzLocalSealerReadiness, prepareWildzLocalCardSealer } from "../../lib/receiz/local-seal/browser";
import { prepareWildzGameImage, type WildzGameImageKind } from "../../lib/receiz/wildz-game-image-export";
import { openWildzSealedCard, verifyWildzSealedCard } from "../../lib/receiz/wildz-sealed-card";
import { createWildzIdentityBoundPlayerVault } from "../../lib/receiz/wildz-identity-vault-binding";
import { embedPortableVaultInPng, withWildzPngPayloadChunk, saveBlobToDevice } from "./card-export";
import { createWildsPlayerVault } from "./wilds-player-vault";
import { initialPlayState } from "./game-state";
import { admitLegacyCard } from "./living-card-proof";
import { sealCollectedCard } from "./portable-card";
import { embedWildsMapInPng } from "./wilds-map-image";

const png = () => Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), c => c.charCodeAt(0));
type Saved = Awaited<ReturnType<typeof prepareWildzGameImage>> & { kind: WildzGameImageKind; original: Uint8Array };
export function OfflineSealBrowserFixture() {
  const [status, setStatus] = useState("Ready to check existing local device custody. No enrollment has been requested.");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  async function act(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } catch (error) { setStatus(`FAIL: ${error instanceof Error ? error.message : String(error)}`); }
    finally { setBusy(false); }
  }
  async function run() {
    if (!await readWildzLocalSealerReadiness()) throw new Error("enrollment_required_no_automatic_enrollment");
    const identity = await createReceizIdentityKeyFile({ owner: { uid: "wildz-browser-qualification", username: "offline-fixture" } });
    const asset = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "offline-fixture", encounterId: "browser-qualification", capturedAt: "2026-07-15T21:00:00.000Z" }), "2026-07-15T21:00:00.000Z");
    const player = createWildsPlayerVault({ playerId: "offline-fixture", exportedAt: "2026-07-15T21:01:00.000Z", playState: { ...initialPlayState, inventory: [asset] }, settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
    const unknown = withWildzPngPayloadChunk(png(), "another.application", "preserve exactly");
    const vault = await createWildzIdentityBoundPlayerVault({ keyFile: identity.keyFile, vaultBytes: embedPortableVaultInPng(unknown, [asset], player) });
    const fixtures: { kind: WildzGameImageKind; bytes: Uint8Array }[] = [
      { kind: "card", bytes: vault }, { kind: "vault", bytes: vault },
      { kind: "identity", bytes: appendReceizIdentityArtifactTrailerToPng(unknown, identity.keyFile) },
      { kind: "map", bytes: embedWildsMapInPng(unknown, { version: 1, rows: [{ z: 0, ranges: [{ minX: 0, maxX: 4 }] }], siteKeys: [] }) }
    ];
    const output: Saved[] = [];
    for (const fixture of fixtures) {
      setStatus(`Sealing ${fixture.kind} in the application worker…`);
      const artifact = await prepareWildzGameImage({ ...fixture, filename: `wildz-browser-${fixture.kind}.png`, allowEnrollment: false });
      await verifyWildzSealedCard(artifact.bytes, fixture.bytes);
      const modified = withWildzPngPayloadChunk(artifact.bytes, "another.application", "tampered");
      if ((await verifyReceizArtifact(modified)).status === "verified-artifact") throw new Error("tampering_accepted");
      output.push({ ...artifact, kind: fixture.kind, original: fixture.bytes });
      setSaved([...output]);
    }
    setStatus("PASS: card, vault, identity, map. Real application worker; canonical verification; exact payload restoration; tampering rejected. Download each file and reopen it below.");
  }
  async function reopen(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const opened = await openWildzSealedCard({ bytes, mimeType: file.type, name: file.name });
    const match = saved.find(row => row.filename === file.name);
    if (match) {
      if (await sha256ReceizBytes(bytes) !== await sha256ReceizBytes(match.bytes)) throw new Error("download_bytes_changed");
      await verifyWildzSealedCard(bytes, match.original);
    }
    setStatus(`PASS: reopened ${file.name}; canonical verification; ${opened.payloadBytes.length} restored payload bytes${match ? "; download byte-identical; original payload byte-identical" : ""}.`);
  }
  return <main style={{ padding: 32, background: "#101820", color: "white", minHeight: "100vh" }}>
    <h1>Wildz v127 browser save qualification</h1>
    <p>Disposable fixture data only. This page does not restore fixtures into your account or perform transfers.</p>
    <button disabled={busy} onClick={() => void act(async () => setStatus(await readWildzLocalSealerReadiness() ? "Existing enrolled signer ready" : "No enrolled signer; enrollment is required"))}>Check existing signer</button>{" "}
    <button disabled={busy} onClick={() => void act(async () => { await prepareWildzLocalCardSealer(); setStatus("Enrolled signer ready"); })}>Enroll browser signing device</button>{" "}
    <button disabled={busy} onClick={() => void act(run)}>Run four save round trips</button>
    <p role="status">{status}</p>
    {saved.map(row => <p key={row.kind}><button disabled={busy} onClick={() => void act(async () => { await saveBlobToDevice(row.blob, row.filename); setStatus(`Downloaded ${row.filename}`); })}>Download {row.kind}</button> {row.filename} ({row.bytes.length} bytes)</p>)}
    <label>Reopen downloaded proof <input disabled={busy} type="file" accept=".png" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void act(() => reopen(file)); }} /></label>
  </main>;
}
