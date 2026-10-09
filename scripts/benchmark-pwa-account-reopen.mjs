/** Synthetic valid long-history account; run after pnpm test. No user data. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createOwnerBoundInitialPlayState } from '../.test-build/src/features/play/game-state.js';
import { appendLivingCardHistory } from '../.test-build/src/features/play/living-card-proof.js';
import { createStoredWildzPlayState, loadWildzRestoredOwnerState } from '../.test-build/src/features/identity/wildz-restore.js';
import { createMemoryWildzContinuityDatabase } from '../.test-build/tests/support/memory-wildz-continuity-database.js';
import { wildzOwnerScope } from '../.test-build/src/lib/receiz/wildz-identity-repository.js';
import { admittedInventoryDiagnostics } from '../.test-build/src/features/play/admitted-inventory.js';

if (process.argv[2] === '--reopen') {
  const { record, session } = JSON.parse(await readFile(process.argv[3], 'utf8'));
  const database = createMemoryWildzContinuityDatabase();
  await database.transaction(['ownerStates'], 'readwrite', tx => tx.put('ownerStates', record, wildzOwnerScope(session.keyId, session.actorId)));
  let ticks = 0, last = performance.now(), maxGap = 0;
  const timer = setInterval(() => { const now = performance.now(); ticks++; maxGap = Math.max(maxGap, now-last); last=now; }, 0);
  const start = performance.now();
  const restored = await loadWildzRestoredOwnerState({ database, session });
  const elapsed = performance.now()-start;
  // Include the final synchronous restore in the responsiveness sample.
  await new Promise(resolve => setTimeout(resolve, 0));
  clearInterval(timer);
  assert.equal(restored.playState.inventory[0].proof.digest, record.playState.inventory[0].proof.digest);
  assert.deepEqual(restored.playState.player, record.playState.player);
  console.log(JSON.stringify({ fixture:'synthetic cold owner-state reopen, fresh Node process; not iPhone timing',
    cards:record.playState.inventory.length, historyEvents:record.playState.inventory[0].manifest.history.events.length,
    jsonBytes:Buffer.byteLength(JSON.stringify(record)), elapsedMs:elapsed, ticks, maxHeartbeatGapMs:maxGap,
    proofAdmissions:admittedInventoryDiagnostics().verifierCalls }, null, 2));
} else {
  const owner = 'pwa_reopen_benchmark', at = '2026-08-11T12:00:00.000Z';
  const state = createOwnerBoundInitialPlayState(owner, at);
  let card = state.inventory[0];
  for (let i=1; i<=300; i++) card = appendLivingCardHistory({ asset:card, event:{
    eventId:`reopen:${i}`, rulesetVersion:'wildz.adventure.v1', occurredAt:new Date(Date.parse(at)+i*60_000).toISOString(),
    source:{mode:'arena',activityId:`arena:reopen:${i}`,actorId:owner,authority:'local'}, evidence:{synthetic:true},
    effects:[{kind:'condition',delta:{assetId:card.id,lifeBefore:'alive',lifeAfter:'alive',fatigueDelta:0,
      injuriesAdded:[],xp:{arena:1},mastery:{},upgradeIdsAdded:[],receiptDigestsAdded:[]}}]
  } });
  const session = { schema:'receiz.wildz.identity_session.v1', keyId:'pwa-benchmark-key', actorId:owner,
    username:owner, displayName:'Benchmark', portableStateStatus:'verified',localAuthority:'verified',remoteStatus:'offline' };
  const record = createStoredWildzPlayState(session, {...state,player:{x:42,z:43},inventory:[card]},null,at);
  if (process.argv[2] === '--write-fixture') {
    assert.ok(process.argv[3], 'a fixture path is required');
    await writeFile(process.argv[3], JSON.stringify({record,session}));
    console.log(JSON.stringify({ fixture: process.argv[3], cards: 1, historyEvents: 301 }));
    process.exit(0);
  }
  const directory = await mkdtemp(join(tmpdir(),'wildz-pwa-reopen-'));
  try {
    const filename = join(directory,'synthetic.json');
    await writeFile(filename, JSON.stringify({record,session}));
    const result = spawnSync(process.execPath,[process.argv[1],'--reopen',filename],{encoding:'utf8'});
    process.stdout.write(result.stdout); process.stderr.write(result.stderr);
    assert.equal(result.status,0);
  } finally { await rm(directory,{recursive:true,force:true}); }
}
