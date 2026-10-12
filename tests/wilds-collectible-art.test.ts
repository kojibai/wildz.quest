import assert from 'node:assert/strict';
import {test} from 'node:test';
import {marketFixtureCards} from '../src/features/market/market-fixture-cards';
import {canonicalPortableCardJson,verifyAnyWildsCard} from '../src/features/play/portable-card';
import {currentLivingGenome} from '../src/features/play/living-card-proof';
import {projectWildsCardArtHabitat,renderWildsCollectibleArt} from '../src/features/play/wilds-collectible-art';
import {renderWildsCardSvg} from '../src/features/play/card-export';
import {wildsCardArtwork} from '../src/features/play/wilds-card-artwork';

test('portraits stay deterministic and leave the complete genome/proof history byte-exact',()=>{
 const seen=new Set<string>();for(const asset of marketFixtureCards){const before=canonicalPortableCardJson(asset),genome=currentLivingGenome(asset),art=wildsCardArtwork(asset);
  assert.equal(art,wildsCardArtwork(JSON.parse(before)));assert.equal(canonicalPortableCardJson(asset),before);assert.equal(verifyAnyWildsCard(asset).ok,true);
  assert.ok(art.includes(genome.identityAnchor));assert.match(art,/data-art-edition="wildz.collectible-portrait.v1"/);assert.match(art,/<radialGradient/);
  const habitat=projectWildsCardArtHabitat(asset,genome);assert.equal(habitat.source,'sealed-discovery-location');assert.equal(habitat.x,'identity' in asset.manifest.variant.traits?asset.manifest.variant.traits.identity.discovery.location.x:null);
  assert.ok(renderWildsCardSvg(asset).includes(renderWildsCollectibleArt(asset,{width:640,height:405})));seen.add(art);
 }assert.equal(seen.size,marketFixtureCards.length);
});
