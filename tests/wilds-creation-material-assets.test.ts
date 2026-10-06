import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
test('bundled CC0 materials preserve source provenance and exact derivative hashes',()=>{
 const folder='public/materials/creation/';
 const manifest=JSON.parse(readFileSync(folder+'manifest.json','utf8'));
 assert.equal(manifest.credit,'Powered by Poly Haven');assert.equal(manifest.files.length,12);
 let total=0;
 for(const asset of manifest.files){
   const bytes=readFileSync(folder+asset.file);total+=bytes.length;
   assert.equal(asset.license,'CC0-1.0');
   assert.ok([256,512].includes(asset.resolution));assert.ok(asset.sourceUrl.startsWith('https://dl.polyhaven.org/'));
   assert.equal(bytes.length,asset.bytes);
   assert.equal('sha256:'+createHash('sha256').update(bytes).digest('hex'),asset.digest);
   assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
 }
 assert.ok(total<1500000);
});
