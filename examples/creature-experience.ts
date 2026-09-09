import {admitWildzExperienceCreature,checkWildzExperienceCompatibility} from "../src/experience/creature";

/** Run at import/revision change; reuse the returned creature throughout the frame loop. */
export function openCreatureTrailExperience(decodedCard:unknown) {
  const admission=admitWildzExperienceCreature(decodedCard);
  if(!admission.ok)return admission;
  const creature=admission.creature;
  return {
    ok:true as const,
    creature,
    routes:[
      {id:"woodland",...checkWildzExperienceCompatibility(creature,{})},
      {id:"river",...checkWildzExperienceCompatibility(creature,{traversal:["swim"]})},
      {id:"sky",...checkWildzExperienceCompatibility(creature,{traversal:["flight"]})},
      {id:"burrow",...checkWildzExperienceCompatibility(creature,{abilityTags:["burrow"]})}
    ]
  };
}
