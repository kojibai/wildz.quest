/** A small display derivative of the verified whole-card SVG. The proof and
 * full-resolution exporter remain untouched. No network or persistent store. */
export async function createWildzMarketGalleryImage(source:string,signal?:AbortSignal):Promise<string>{
 if(typeof document==='undefined')return source;
 signal?.throwIfAborted();
 const image=new window.Image(),canvas=document.createElement('canvas');
 // Bound each decoded gallery front to 206,592 pixels, rather than retaining
 // 750 × 1050 SVG/filter surfaces for the entire collection.
 canvas.width=384;canvas.height=538;
 const context=canvas.getContext('2d');if(!context){canvas.width=1;canvas.height=1;return source;}
 let reader:FileReader|undefined,expired=false;
 const release=()=>{image.src='';canvas.width=1;canvas.height=1;reader?.abort();};
 const assertActive=()=>{signal?.throwIfAborted();if(expired)throw Error('The card preview timed out.');};
 let cancel:()=>void=()=>{},deadline:ReturnType<typeof setTimeout>|undefined;
 const interrupted=new Promise<never>((_resolve,reject)=>{
  cancel=()=>{release();reject(signal?.reason??new DOMException('Card preview cancelled.','AbortError'));};
  signal?.addEventListener('abort',cancel,{once:true});
  deadline=setTimeout(()=>{expired=true;release();reject(Error('The card preview timed out.'));},15000);
 });
 const work=async()=>{
  const svg=decodeURIComponent(source.slice(source.indexOf(',')+1));
  image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/<svg\b[^>]*>/,root=>root.replace(/width="[^"]*"/,'width="384"').replace(/height="[^"]*"/,'height="538"')))}`;
  image.decoding='async';await image.decode();assertActive();
  context.drawImage(image,0,0,384,538);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('The card preview could not be rendered.')),'image/webp',.92));
  assertActive();
  const url=await new Promise<string>((resolve,reject)=>{const activeReader=new FileReader();reader=activeReader;activeReader.onload=()=>resolve(String(activeReader.result));activeReader.onerror=()=>reject(Error('The card preview could not be read.'));activeReader.readAsDataURL(blob);});
  assertActive();return url;
 };
 try{return await Promise.race([work(),interrupted]);}
 finally{signal?.removeEventListener('abort',cancel);clearTimeout(deadline);release();}
}
