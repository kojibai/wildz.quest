import {sha256PortableBasis} from "./portable-card";
import {parseWildzPlayerCoordinate} from "../../lib/receiz/wildz-player-coordinate";

/** Cosmetic anatomy derives from a stable identity, never position, frame time or randomness. */
export function projectWildsExplorerAnatomy(identity:string) {
  const key=parseWildzPlayerCoordinate(identity)?.actorId??identity;
  const digest=sha256PortableBasis(`wildz.explorer.anatomy.v1:${key}`).slice(7);
  const detailDigest=sha256PortableBasis(`wildz.explorer.face-detail.v1:${key}`).slice(7);
  const unit=(offset:number)=>Number.parseInt(digest.slice(offset,offset+4),16)/65535;
  const detailUnit=(offset:number)=>Number.parseInt(detailDigest.slice(offset,offset+4),16)/65535;
  return Object.freeze({
    version:"wildz.explorer.anatomy.v1" as const,fingerprint:digest,
    jaw:.76+unit(0)*.22,cheek:.91+unit(4)*.15,faceHeight:.96+unit(8)*.08,
    eyeSpacing:.071+unit(12)*.019,eyeSize:.027+unit(16)*.009,browTilt:(unit(20)-.5)*.24,
    noseWidth:.023+unit(24)*.014,noseLength:.035+unit(28)*.025,mouthWidth:.042+unit(32)*.015,
    lipFullness:.007+unit(36)*.006,earSize:.034+unit(40)*.012,
    shoulders:.95+unit(44)*.1,waist:.9+unit(48)*.13,height:.98+unit(52)*.04,
    iris:["#463c2b","#596344","#52717c","#785c37","#3d3029","#74765e"][Math.floor(unit(56)*5.999)],
    freckles:unit(60)>.62,
    detail:Object.freeze({
      depth:.86+detailUnit(0)*.2,temple:.88+detailUnit(4)*.17,
      cheekHeight:.025+detailUnit(8)*.038,chin:.009+detailUnit(12)*.016,
      eyeHeight:.45+detailUnit(16)*.18,eyeTilt:(detailUnit(20)-.5)*.2,
      lidFold:.003+detailUnit(24)*.003,asymmetry:(detailUnit(28)-.5)*.012,
      noseBridge:.8+detailUnit(32)*.38,noseTip:.82+detailUnit(36)*.32,
      cupidBow:.002+detailUnit(40)*.005,lowerLip:.82+detailUnit(44)*.3,
      earAngle:(detailUnit(48)-.5)*.22,irisSeed:detailUnit(52),
      blinkMs:2800+detailUnit(56)*3000,skinVariation:.035+detailUnit(60)*.025
    })
  });
}
export type WildsExplorerAnatomy=ReturnType<typeof projectWildsExplorerAnatomy>;
