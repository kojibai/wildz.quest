import assert from 'node:assert/strict';
import {test} from 'node:test';
import sharp from 'sharp';
import {marketFixtureCards} from '../src/features/market/market-fixture-cards';
import {canonicalPortableCardJson,verifyAnyWildsCard} from '../src/features/play/portable-card';
import {currentLivingGenome} from '../src/features/play/living-card-proof';
import {renderHeartboundSvg} from '../src/features/play/heartbound-renderer';
import {projectCardCreatureLevelAppearance} from '../src/features/play/wilds-creature-level-appearance';
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

test('habitat paints the entire requested portrait frame without transparent side bands',async()=>{
 for(const size of [{width:640,height:405},{width:360,height:540},{width:560,height:440}]){
  const svg=renderWildsCollectibleArt(marketFixtureCards[0],size);
  const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,size.width);assert.equal(info.height,size.height);
  // The painted sky intentionally includes translucent light; empty viewport
  // bands have zero alpha and expose the card's flat backing instead.
  const transparentPixel=data.findIndex((alpha,index)=>index%info.channels===info.channels-1&&alpha===0);
  assert.equal(transparentPixel,-1,`${size.width}×${size.height} habitat must cover every portrait pixel`);
 }
});

test('portrait viewports cover scenery while fitting the complete anatomy independently',()=>{
 const art=renderWildsCollectibleArt(marketFixtureCards[0],{width:640,height:405});
 assert.match(art.slice(0,art.indexOf('>')),/viewBox="0 0 640 405"/);
 for(const layer of ['habitat-back','habitat-front']){
  const viewport=art.match(new RegExp(`<svg\\b[^>]*data-art-layer="${layer}"[^>]*>`))?.[0];
  assert.ok(viewport,`${layer} needs its own portrait viewport`);
  assert.match(viewport,/width="640" height="405"/);
  assert.match(viewport,/viewBox="0 0 560 440"/);
  assert.match(viewport,/preserveAspectRatio="xMidYMid slice"/);
 }
 const creature=art.match(/<svg\b[^>]*data-art-layer="creature"[^>]*>/)?.[0];
 assert.ok(creature);
 assert.match(creature,/width="640" height="405"/);
 assert.match(creature,/viewBox="0 0 560 440"/);
 assert.match(creature,/preserveAspectRatio="xMidYMid meet"/);
 assert.ok(art.indexOf('data-art-layer="habitat-back"')<art.indexOf('data-art-layer="creature"'));
 assert.ok(art.indexOf('data-art-layer="creature"')<art.indexOf('data-art-layer="habitat-front"'));
 const ids=[...art.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(new Set(ids).size,ids.length,'shared paints must have a single definition');
 for(const reference of art.matchAll(/url\(#([^)]+)\)/g))assert.ok(ids.includes(reference[1]),`missing paint ${reference[1]}`);
});

test('habitat-free portraits keep the historical full-body geometry and centered framing',()=>{
 for(const asset of marketFixtureCards){
  const genome=currentLivingGenome(asset),growth=projectCardCreatureLevelAppearance(asset);
  const historical=renderHeartboundSvg(genome,'card',{width:640,height:405,title:asset.manifest.name,fit:'full-body',levelAppearance:growth});
  const art=renderWildsCollectibleArt(asset,{width:640,height:405,habitat:false});
  assert.doesNotMatch(art,/data-art-layer="habitat-/);
  assert.match(art,/<svg\b[^>]*data-art-layer="creature"[^>]*preserveAspectRatio="xMidYMid meet"/);
  assert.match(historical.slice(0,historical.indexOf('>')),/viewBox="0 0 560 440"/);
  for(const geometry of historical.matchAll(/\b(?:d|transform|transform-origin)="[^"]*"/g))assert.ok(art.includes(geometry[0]),`lost anatomy ${geometry[0]}`);
 }
});
