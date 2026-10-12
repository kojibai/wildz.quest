import assert from 'node:assert/strict';
import {test} from 'node:test';
import {wildzRemoteMessengerPrincipal,type WildzRemoteSession} from '../src/lib/receiz/wildz-session-bridge';

test('standalone messages preserve the admitted identity and historical Vault participant coordinates',()=>{
 const identity:WildzRemoteSession={status:'connected',subjectKey:'a'.repeat(64),sessionKeyId:'receiz-key',authority:'identity-key',actorId:'keeper',profileHandle:'keeper.receiz.id',displayName:null};
 assert.equal(wildzRemoteMessengerPrincipal(identity),'keeper.receiz.id');
 assert.equal(wildzRemoteMessengerPrincipal({...identity,authority:'proof-sealed-vault'}),`vault:${identity.subjectKey}`);
 assert.equal(wildzRemoteMessengerPrincipal({status:'offline',actorId:null,profileHandle:null,displayName:null}),null);
});
