import {sha256PortableBasis} from "./portable-card";
import {parseWildzPlayerCoordinate} from "../../lib/receiz/wildz-player-coordinate";

/** Cosmetic anatomy derives from a stable identity, never position, frame time or randomness. */
export function projectWildsExplorerAnatomy(identity:string) {
  const key=parseWildzPlayerCoordinate(identity)?.actorId??identity;
  const digest=sha256PortableBasis(`wildz.explorer.anatomy.v1:${key}`).slice(7);
  const unit=(offset:number)=>Number.parseInt(digest.slice(offset,offset+4),16)/65535;
  return Object.freeze({
    version:"wildz.explorer.anatomy.v1" as const,fingerprint:digest,
    jaw:.76+unit(0)*.22,cheek:.91+unit(4)*.15,faceHeight:.96+unit(8)*.08,
    eyeSpacing:.071+unit(12)*.019,eyeSize:.027+unit(16)*.009,browTilt:(unit(20)-.5)*.24,
    noseWidth:.023+unit(24)*.014,noseLength:.035+unit(28)*.025,mouthWidth:.042+unit(32)*.015,
    lipFullness:.007+unit(36)*.006,earSize:.034+unit(40)*.012,
    shoulders:.95+unit(44)*.1,waist:.9+unit(48)*.13,height:.98+unit(52)*.04,
    iris:["#463c2b","#596344","#52717c","#785c37","#3d3029","#74765e"][Math.floor(unit(56)*5.999)],
    freckles:unit(60)>.62
  });
}
export type WildsExplorerAnatomy=ReturnType<typeof projectWildsExplorerAnatomy>;
