import { DataTexture, MeshStandardMaterial, TextureLoader, RepeatWrapping, SRGBColorSpace, NoColorSpace, RGBAFormat, UnsignedByteType, LinearMipmapLinearFilter, Vector2, type Texture } from 'three';
type Surface='timber'|'stone'|'hay';
type Options={resolution:256|512;anisotropy:number;load?:(url:string)=>Promise<Texture>};
const SOURCE:Partial<Record<Surface,string>>={timber:'wood',stone:'stone'};
const textureBytes=(size:number)=>Math.ceil(size*size*4*4/3);
function fallback(surface:Surface):DataTexture {
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,noise=((x*19+y*37+x*y*3)%31)/31;
    const grain=Math.sin(x*.44+Math.sin(y*.07)*1.2);
    const seam=surface==='timber'&&(x%32<2||y%64<2)?-.25:0;
    const shade=surface==='stone'?.65+noise*.25:surface==='hay'?.7+Math.sin(x*.9+y*.06)*.1+noise*.15:.75+grain*.05+noise*.08+seam;
    const base=surface==='stone'?[160,162,149]:surface==='hay'?[191,167,103]:[161,119,74];
    data[i]=base[0]*shade;data[i+1]=base[1]*shade;data[i+2]=base[2]*shade;data[i+3]=255;
  }
  return new DataTexture(data,size,size,RGBAFormat,UnsignedByteType);
}
/** One library per scene. No network or surface allocation until a resident material is used. */
export function createCreationMaterialLibrary(options:Options){
  const materials=new Map<Surface,MeshStandardMaterial>(), textures=new Map<Surface,Texture[]>(), jobs=new Map<Surface,Promise<void>>();
  let closed=false;
  const loader=options.load || ((url:string)=>new Promise<Texture>((resolve,reject)=>new TextureLoader().load(url,resolve,undefined,reject)));
  const configure=(t:Texture,albedo:boolean)=>{
    t.colorSpace=albedo?SRGBColorSpace:NoColorSpace;t.wrapS=t.wrapT=RepeatWrapping;
    t.repeat.set(1/1.8,1/1.8);t.anisotropy=Math.max(1,Math.min(4,options.anisotropy));
    t.minFilter=LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;
  };
  const material=(id:string)=>{
    if(closed)throw Error('creation_material_library_closed');
    if(!['timber','stone','hay'].includes(id))throw Error('creation_material_unregistered');
    const surface=id as Surface;let m=materials.get(surface);
    if(!m){
      const t=fallback(surface);configure(t,true);textures.set(surface,[t]);
      m=new MeshStandardMaterial({map:t,bumpMap:t,bumpScale:surface==='stone'?.025:.012,roughness:surface==='timber'?.72:.94,metalness:0});
      m.name='creation:'+surface;materials.set(surface,m);
    }
    return m;
  };
  return {
    material,
    maximumTextureBytes:6*textureBytes(options.resolution)+3*textureBytes(128),
    load(id:string):Promise<void>{
      if(closed)return Promise.resolve();
      const m=material(id),surface=id as Surface,source=SOURCE[surface];
      if(!source)return Promise.resolve();
      const existing=jobs.get(surface);if(existing)return existing;
      const job=(async()=>{
        const loaded=await Promise.allSettled(['diff','normal','rough'].map(map=>loader('/materials/creation/'+source+'-'+map+'-'+options.resolution+'.webp')));
        const next=[...new Set(loaded.flatMap(result=>result.status==='fulfilled'?[result.value]:[]))];
        if(closed||loaded.some(result=>result.status==='rejected')){next.forEach(t=>t.dispose());return;}
        const maps=loaded.map(result=>(result as PromiseFulfilledResult<Texture>).value);
        maps.forEach((t,i)=>configure(t,i===0));
        const prior=textures.get(surface)||[];textures.set(surface,maps);
        m.map=maps[0];m.normalMap=maps[1];m.roughnessMap=maps[2];m.bumpMap=null;m.normalScale=new Vector2(.55,.55);m.needsUpdate=true;
        prior.forEach(t=>t.dispose());
      })();
      jobs.set(surface,job);return job;
    },
    textureBytes(){return [...textures.values()].reduce((sum,maps)=>sum+(maps.length===1?textureBytes(128):maps.length*textureBytes(options.resolution)),0);},
    dispose(){if(closed)return;closed=true;materials.forEach(m=>m.dispose());new Set([...textures.values()].flat()).forEach(t=>t.dispose());materials.clear();textures.clear();}
  };
}
