// Build-time only. Run with --source-dir /private/tmp to use previously downloaded originals.
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const sources=[
  {id:'wood',asset:'wood_floor_deck',author:'Dimitrios Savva',roles:{diff:'diff',normal:'nor_gl',rough:'rough'}},
  {id:'stone',asset:'rock_boulder_dry',author:'Dimitrios Savva; Rico Cilliers',roles:{diff:'diff',normal:'nor_gl',rough:'rough'}}
];
const folder=resolve('public/materials/creation');await mkdir(folder,{recursive:true});
const sourceIndex=process.argv.indexOf('--source-dir'),sourceDir=sourceIndex>=0?process.argv[sourceIndex+1]:null;
const sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const files=[];
for(const source of sources)for(const [role,suffix] of Object.entries(source.roles)){
  const url='https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/'+source.asset+'/'+source.asset+'_'+suffix+'_1k.jpg';
  let original;
  if(sourceDir)original=await readFile(resolve(sourceDir,'wildz-'+source.id+'-'+role+'.jpg'));
  else{const response=await fetch(url);if(!response.ok)throw Error('Material download failed: '+response.status);original=Buffer.from(await response.arrayBuffer());}
  const metadata=await sharp(original).metadata();if(metadata.width!==1024||metadata.height!==1024)throw Error('Unexpected source dimensions');
  for(const resolution of [256,512]){
    const file=source.id+'-'+role+'-'+resolution+'.webp';
    const pipeline=sharp(original).resize(resolution,resolution,{kernel:'lanczos3'});
    const bytes=await pipeline.webp(role==='diff'?{quality:90}:{lossless:true}).toBuffer();
    await writeFile(resolve(folder,file),bytes);
    files.push({file,role,resolution,bytes:bytes.length,digest:sha(bytes),sourceUrl:url,sourceDigest:sha(original),assetUrl:'https://polyhaven.com/a/'+source.asset,author:source.author,license:'CC0-1.0'});
  }
}
await writeFile(resolve(folder,'manifest.json'),JSON.stringify({schema:'wildz.creation-material-assets.v1',provider:'Poly Haven',credit:'Powered by Poly Haven',licenseUrl:'https://polyhaven.com/license',apiUsedForSelection:'https://github.com/Poly-Haven/Public-API',files},null,2)+'\n');
console.log(JSON.stringify({files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0)}));
