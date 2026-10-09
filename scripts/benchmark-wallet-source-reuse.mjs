/** Synthetic signed archive, never a user's account. Run after pnpm test. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createReceizIdentityKeyFile, projectReceizIdentityAccount, serializeReceizIdentityArtifact } from '@receiz/sdk';
import { createWildzIdentityRepository } from '../.test-build/src/lib/receiz/wildz-identity-repository.js';
import { createMemoryWildzContinuityDatabase } from '../.test-build/tests/support/memory-wildz-continuity-database.js';
import { createWildsWalletControllerDriver } from '../.test-build/src/features/play/wallet/wilds-wallet-controller-driver.js';
import { createWildsWalletSessionCache } from '../.test-build/src/features/play/wallet/wilds-wallet-controller.js';
import { projectWildsWalletFromIdentityAccount } from '../.test-build/src/features/play/wallet/wilds-wallet-source-authority.js';

const [mode, filename, option] = process.argv.slice(2);
if (mode === '--make') {
  const source = JSON.parse(await readFile(option, 'utf8'));
  const card = source.record.playState.inventory[0];
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: 'synthetic-wallet-reopen', username: 'synthetic-wallet-reopen', displayName: 'Synthetic benchmark' },
    portableState: { snapshot: { cards: Array.from({length:16}, () => structuredClone(card)), wallet: { balancePhiMicro:'2500000' } } }
  });
  assert.equal((await projectReceizIdentityAccount(identity.keyFile)).portableStateStatus, 'verified');
  await writeFile(filename, serializeReceizIdentityArtifact(identity.keyFile), { mode:0o600 });
  console.log(JSON.stringify({fixture:filename,identityBytes:Buffer.byteLength(serializeReceizIdentityArtifact(identity.keyFile)),historyEventsPerCopy:card.manifest.history.events.length,copies:16}));
} else if (mode === '--sample') {
  const keyFile = JSON.parse(await readFile(filename,'utf8'));
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({database});
  const prepared = await repository.prepare(keyFile);
  await database.transaction(['identities','meta'],'readwrite',tx=>repository.writePrepared(tx,prepared,true));
  const originalRead = database.read.bind(database);
  let sourceReads=0;
  database.read = (store,key) => { if(store==='identities') sourceReads++; return originalRead(store,key); };
  const driver = createWildsWalletControllerDriver({identityKey:prepared.session.actorId,authorityGeneration:keyFile.keyId,
    cache:createWildsWalletSessionCache(4),publish(){},fetcher:async()=>{throw Error('offline');}});
  const project = () => repository.withKeyFile(keyFile.keyId,async decoded=>projectWildsWalletFromIdentityAccount(await projectReceizIdentityAccount(decoded)));
  let last=performance.now(),maxGap=0,ticks=0,result;
  const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;ticks++;},0);
  const started=performance.now();
  for(let attempt=0;attempt<6;attempt++) {
    if(option==='before') result=await project();
    else {await driver.projectSourceAuthority(project);result=driver.state.sourceSnapshot;}
  }
  const elapsedMs=performance.now()-started;
  await new Promise(resolve=>setTimeout(resolve,0));clearInterval(timer);
  assert.equal(result.summary.admittedPhiMicro,'2500000');
  assert.equal(sourceReads,option==='before'?6:1);
  console.log(JSON.stringify({version:option,elapsedMs,maxHeartbeatGapMs:maxGap,ticks,sourceReads,attempts:6,sourceDigest:keyFile.portableState.proof.digestSha256Hex,balance:result.summary.admittedPhiMicro}));
} else if(mode==='--run') {
  const samples=[];
  for(let pair=0;pair<5;pair++)for(const version of pair%2?['after','before']:['before','after']) {
    const result=spawnSync(process.execPath,[process.argv[1],'--sample',filename,version],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);samples.push({pair,...JSON.parse(result.stdout)});
  }
  assert.equal(new Set(samples.map(s=>s.sourceDigest)).size,1);
  const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
  const summary=Object.fromEntries(['before','after'].map(version=>{const rows=samples.filter(s=>s.version===version);return [version,{medianElapsedMs:median(rows.map(s=>s.elapsedMs)),medianMaxHeartbeatGapMs:median(rows.map(s=>s.maxHeartbeatGapMs)),sourceReads:rows[0].sourceReads}];}));
  console.log(JSON.stringify({scenario:'Six isolated wallet source-projection attempts on a synthetic signed Seal containing 16 copies of one valid 301-event history; fresh Node process, not startup or iPhone timing',summary,samples},null,2));
} else throw Error('Use --make <seal.json> <history-fixture.json>, --sample <seal.json> before|after, or --run <seal.json>');
