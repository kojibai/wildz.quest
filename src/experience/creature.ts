/** Source entry point for creature-compatible experiences built from this repository. */
import {verifyAndAdmitWildsCard,isAdmittedWildsCard} from "../features/play/admitted-inventory";
import {canonicalPortableCardJson,type PortableCardAsset} from "../features/play/portable-card";
import {isLivingCardAsset} from "../features/play/living-card-types";
import {currentCreatureHistoryProjection} from "../features/play/living-card-proof";
import {emptyAdventureCondition} from "../features/play/adventure/card-condition";
import {projectCreatureCapabilityIdentity,projectCreatureRuntimeCapabilities} from "../features/play/creature-capability-identity";
import {projectCardCreatureVisualIdentity} from "../features/play/creature-visual-identity";
import type {WildsTraversalCapability} from "../features/play/wilds-traversal-capabilities";

function project(card:PortableCardAsset) {
  const identity=projectCreatureCapabilityIdentity(card);
  const condition=isLivingCardAsset(card)?currentCreatureHistoryProjection(card).condition:emptyAdventureCondition(card.id);
  return Object.freeze({
    contract:"wildz.experience-creature.v1" as const,
    card,
    assetId:card.id,
    proofDigest:identity.digestInput.proofDigest,
    revisionDigest:identity.digestInput.revisionDigest,
    identity,
    visual:projectCardCreatureVisualIdentity(card),
    condition,
    runtime:projectCreatureRuntimeCapabilities(identity,condition)
  });
}
export type WildzExperienceCreature=ReturnType<typeof project>;
const projections=new WeakMap<PortableCardAsset,WildzExperienceCreature>();

/** Admit a decoded game-card payload once. Native artifact envelopes must be opened by the SDK first. */
export function admitWildzExperienceCreature(value:unknown):
  {ok:true;creature:WildzExperienceCreature}|{ok:false;reason:"invalid-creature"} {
  try {
    if(!value||typeof value!=="object")return {ok:false,reason:"invalid-creature"};
    const input=value as PortableCardAsset;
    const card=isAdmittedWildsCard(input)?input:JSON.parse(canonicalPortableCardJson(value)) as PortableCardAsset;
    if(!isAdmittedWildsCard(card)&&!verifyAndAdmitWildsCard(card))return {ok:false,reason:"invalid-creature"};
    let creature=projections.get(card);
    if(!creature){creature=project(card);projections.set(card,creature);}
    return {ok:true,creature};
  }catch{return {ok:false,reason:"invalid-creature"};}
}

export type WildzExperienceRequirements=Readonly<{
  traversal?:readonly WildsTraversalCapability[];
  abilityTags?:readonly string[];
}>;
/** Readiness is a local projection, never permission to spend, transfer, or append history. */
export function checkWildzExperienceCompatibility(creature:WildzExperienceCreature,requirements:WildzExperienceRequirements) {
  const tags=new Set(creature.runtime.abilities.filter(a=>a.available).flatMap(a=>a.descriptor.tags));
  const missingTraversal=(requirements.traversal??[]).filter(c=>!creature.runtime.capabilities.includes(c));
  const missingAbilityTags=(requirements.abilityTags??[]).filter(tag=>!tags.has(tag));
  return Object.freeze({compatible:missingTraversal.length===0&&missingAbilityTags.length===0,missingTraversal:Object.freeze(missingTraversal),missingAbilityTags:Object.freeze(missingAbilityTags)});
}
