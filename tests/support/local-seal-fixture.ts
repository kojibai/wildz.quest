

import { createReceizIdentityKeyFile } from "@receiz/sdk";
import { createWildzIdentityBoundPlayerVault } from "../../src/lib/receiz/wildz-identity-vault-binding";
import { embedPortableVaultInPng } from "../../src/features/play/card-export";
import { createWildsPlayerVault } from "../../src/features/play/wilds-player-vault";
import { initialPlayState } from "../../src/features/play/game-state";
import { admitLegacyCard } from "../../src/features/play/living-card-proof";
import { sealCollectedCard } from "../../src/features/play/portable-card";
import { withWildzPngPayloadChunk } from "../../src/features/play/card-export";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
export async function signedLocalCardFixture() {
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "local-card-test", username: "keeper" } });
  const asset = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "local-card-test", capturedAt: "2026-07-15T21:00:00.000Z" }), "2026-07-15T21:00:00.000Z");
  const player = createWildsPlayerVault({ playerId: "keeper", exportedAt: "2026-07-15T21:01:00.000Z", playState: { ...initialPlayState, inventory: [asset] }, settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const unknown = withWildzPngPayloadChunk(png, "another.application", "preserve exactly");
  return createWildzIdentityBoundPlayerVault({ keyFile: identity.keyFile, vaultBytes: embedPortableVaultInPng(unknown, [asset], player) });
}

