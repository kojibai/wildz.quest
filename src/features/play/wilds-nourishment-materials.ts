import * as THREE from 'three';

/** Small authored surfaces are generated once locally, with no asset request or dependency. */
export function createWildsNourishmentTexture(kind: 'coat' | 'fruit' | 'leaf') {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const i=(y*size+x)*4, noise=((Math.imul(x+17,y+31)*2654435761)>>>0)%101/100;
    const grain = kind==='coat' ? .78+noise*.18+Math.sin(x*1.9+y*.27)*.035
      : kind==='fruit' ? .85+noise*.12+Math.sin(x*.2+y*.11)*.025
      : .72+noise*.14+(Math.abs(x-32)<1.5 || Math.abs((y*.75+x)%16-8)<1 ? .12:0);
    pixels[i]=Math.round(255*grain); pixels[i+1]=Math.round(255*grain); pixels[i+2]=Math.round(255*grain); pixels[i+3]=255;
  }
  const texture = new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace; texture.generateMipmaps=true;
  texture.minFilter=THREE.LinearMipmapLinearFilter; texture.magFilter=THREE.LinearFilter; texture.needsUpdate=true;
  return texture;
}
export function createWildsAppleGeometry() {
  const geometry = new THREE.SphereGeometry(1,12,8), positions = geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),angle=Math.atan2(z,x);
    const shoulder=1+Math.sin(angle*5)*.035*(.3+Math.abs(y)*.7);
    const dimple=Math.max(0,(Math.abs(y)-.75)/.25)*.16;
    positions.setXYZ(i,x*shoulder,y*.94-Math.sign(y)*dimple,z*shoulder);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return geometry;
}
export function createWildsFoodLeafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0,-1); shape.bezierCurveTo(-.85,-.2,-.7,.5,0,1); shape.bezierCurveTo(.7,.5,.85,-.2,0,-1);
  const geometry = new THREE.ShapeGeometry(shape,5), positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++) positions.setZ(i,.1*(1-Math.abs(positions.getY(i))));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return geometry;
}
