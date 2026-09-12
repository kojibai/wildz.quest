import * as THREE from "three";

const SIZE = 128;
let surface: Promise<Uint8Array | null> | undefined;

// A single optional decode per page. Gameplay and the first frame use the fallback.
function loadSurface() {
  return surface ??= fetch("/wilds-forest-floor.webp")
    .then(async response => {
      if (!response.ok) return null;
      const bitmap = await createImageBitmap(await response.blob());
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = SIZE;
        const context = canvas.getContext("2d");
        if (!context) return null;
        context.drawImage(bitmap, 0, 0, SIZE, SIZE);
        return new Uint8Array(context.getImageData(0, 0, SIZE, SIZE).data);
      } finally { bitmap.close(); }
    }).catch(() => null);
}

export function createWildsGroundTexture(color: string) {
  const tint = new THREE.Color(color).convertLinearToSRGB();
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let index = 0; index < data.length; index += 4) {
    // Match the decoded surface's mean so detail arriving does not flash the ground.
    const grain = .85 + (((index / 4 * 2654435761) >>> 0) % 101) / 337;
    data[index] = 85 * (.55 + tint.r * .45) * grain;
    data[index + 1] = 72 * (.55 + tint.g * .45) * grain;
    data[index + 2] = 42 * (.55 + tint.b * .45) * grain;
    data[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Update the existing sampler: no material recompile, extra map, or render callback. */
export function hydrateWildsGroundTexture(texture: THREE.DataTexture, color: string) {
  let cancelled = false;
  const timer = setTimeout(() => {
    void loadSurface().then(pixels => {
      if (cancelled || !pixels) return;
      const tint = new THREE.Color(color).convertLinearToSRGB();
      const data = texture.image.data;
      if (!data) return;
      for (let index = 0; index < pixels.length; index += 4) {
        data[index] = pixels[index] * (.55 + tint.r * .45);
        data[index + 1] = pixels[index + 1] * (.55 + tint.g * .45);
        data[index + 2] = pixels[index + 2] * (.55 + tint.b * .45);
      }
      texture.needsUpdate = true;
    });
  }, 1200);
  return () => { cancelled = true; clearTimeout(timer); };
}
