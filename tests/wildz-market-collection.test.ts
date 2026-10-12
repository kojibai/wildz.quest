import assert from 'node:assert/strict';
import {test} from 'node:test';
import {initialPlayState} from '../src/features/play/game-state';
import {createPublicWildzProfileRecord} from '../src/lib/receiz/wildz-profile-record';
import {projectWildzMarketCollection} from '../src/lib/receiz/wildz-market-collection';

test('collection carries only the exact public card already included in the owner gallery',()=>{
 const asset=initialPlayState.inventory[0]!;
 const profile=createPublicWildzProfileRecord({username:'cardowner',vault:[{id:asset.id,name:asset.manifest.name,proofDigest:asset.proof.digest,visibility:'public'}]},'https://wildz.quest/u/cardowner');
 const [card]=projectWildzMarketCollection([{...profile,vaultCards:[asset]}],[]);
 assert.equal(card?.asset?.proof.digest,asset.proof.digest);
 const tampered=structuredClone(asset);tampered.manifest.name='Forged public card';
 assert.equal(projectWildzMarketCollection([{...profile,vaultCards:[tampered]}],[])[0]?.asset,undefined);
 const privateProfile={...profile,profile:{...profile.profile,vault:[]},vaultCards:[asset]};
 assert.equal(projectWildzMarketCollection([privateProfile],[]).length,0);
});
