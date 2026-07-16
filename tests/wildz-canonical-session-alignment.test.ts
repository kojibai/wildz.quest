import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizIdIdentity } from "@receiz/sdk";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import {
  loadWildzRestoredOwnerState,
  saveWildzRestoredPlayState
} from "../src/features/identity/wildz-restore";
import {
  alignWildzContinuityWithProofSession,
  type WildzContinuitySnapshot
} from "../src/lib/receiz/wildz-identity-adapter";
import {
  createWildzIdentityRepository,
  wildzOwnerScope
} from "../src/lib/receiz/wildz-identity-repository";
import type { WildzRemoteSession } from "../src/lib/receiz/wildz-session-bridge";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

test("a canonical v104 account atomically rebinds the matching local key and owner state", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const identity = await createReceizIdIdentity({
    username: "self_asserted_label",
    displayName: "Local Label"
  });
  const prepared = await repository.prepare(identity.keyFile);
  await database.transaction(["identities", "meta"], "readwrite", (tx) =>
    repository.writePrepared(tx, prepared, true)
  );
  const playState = createOwnerBoundInitialPlayState(prepared.session.actorId);
  await saveWildzRestoredPlayState({
    database,
    session: prepared.session,
    playState,
    player: null,
    character: null
  });
  const snapshot: WildzContinuitySnapshot = {
    session: prepared.session,
    playState,
    character: null,
    playerContinuity: null,
    restoreEpoch: 0
  };
  const remote: WildzRemoteSession = {
    status: "connected",
    subjectKey: "f".repeat(64),
    sessionKeyId: prepared.session.keyId,
    authority: "identity-key",
    actorId: "canonical_owner",
    profileHandle: "canonical_owner.receiz.id",
    displayName: "Canonical Owner"
  };

  const aligned = await alignWildzContinuityWithProofSession(snapshot, remote, {
    database,
    repository
  });

  assert.equal(aligned.session.keyId, prepared.session.keyId);
  assert.equal(aligned.session.actorId, "canonical_owner");
  assert.equal(aligned.session.username, "canonical_owner");
  assert.equal(aligned.session.displayName, "Canonical Owner");
  assert.equal(aligned.session.remoteStatus, "connected");
  assert.deepEqual(await repository.active(), aligned.session);
  assert.equal(await database.read("ownerStates", wildzOwnerScope(prepared.session.keyId, "self_asserted_label")), null);
  assert.ok(await loadWildzRestoredOwnerState({ database, session: aligned.session }));

  const repeated = await alignWildzContinuityWithProofSession(aligned, remote, {
    database,
    repository
  });
  assert.equal(repeated, aligned, "an already aligned session must not restart the connection effect");
});
