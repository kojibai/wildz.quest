"use client";
import {useEffect} from "react";
import {useThree} from "@react-three/fiber";
import {recordWildzBrowserLifecycle} from "./pwa-lifecycle";

/** Graphics failures are recorded at the event, never sampled in the game loop. */
export function WildsGraphicsLifecycle() {
 const gl=useThree(state=>state.gl);
 useEffect(()=>{
  const canvas=gl.domElement;
  const lost=()=>recordWildzBrowserLifecycle({event:"graphics-context-lost",geometries:gl.info.memory.geometries,textures:gl.info.memory.textures});
  const restored=()=>recordWildzBrowserLifecycle({event:"graphics-context-restored"});
  canvas.addEventListener("webglcontextlost",lost);
  canvas.addEventListener("webglcontextrestored",restored);
  return()=>{canvas.removeEventListener("webglcontextlost",lost);canvas.removeEventListener("webglcontextrestored",restored);};
 },[gl]);
 return null;
}
