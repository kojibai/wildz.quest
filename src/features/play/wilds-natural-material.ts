"use client";
import { useMemo } from "react";
import * as THREE from "three";
type Role="bark"|"leaf"|"skin";
const textures=new Map<Role,THREE.DataTexture>();
/** Three small, shared, static maps: no animation, extra meshes, or runtime requests. */
export function useWildsNaturalTexture(role:Role) {
  return useMemo(()=>{
    const cached=textures.get(role);if(cached)return cached;
    const size=128,data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const noise=((Math.imul(x+19,374761393)^Math.imul(y+7,668265263))>>>0)%256/255;
      const grain=Math.sin(x*.65+Math.sin(y*.049)*2.2);
      const vein=Math.abs(Math.sin((x+y*.4)*Math.PI/16));
      const shade=role==="bark"?.67+.19*grain+.12*noise:role==="leaf"?.83+.09*vein+.08*noise:.94+.06*noise;
      const offset=(y*size+x)*4;
      data[offset]=data[offset+1]=data[offset+2]=Math.round(Math.max(.25,shade)*255);data[offset+3]=255;
    }
    const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
    texture.repeat.set(role==="bark"?3:2,role==="bark"?1:2);texture.needsUpdate=true;
    textures.set(role,texture);return texture;
  },[role]);
}
