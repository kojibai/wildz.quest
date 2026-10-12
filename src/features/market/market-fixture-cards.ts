import {creatureForm} from '../play/creature-catalog';
import {discoverLivingCreature} from '../play/living-taxonomy';
import {deriveKaiKlokMoment} from '../play/kai-klok-moment';
import {sealDiscoveredCard} from '../play/portable-card';
import {admitLegacyCard,appendLivingCardHistory} from '../play/living-card-proof';

/** Real deterministic card rendering, with development-only simulated ownership.
 * These examples are never published or passed to a payment/source runtime. */
export const marketFixtureCards=['mintcub','ledgerfox','voltray'].map((family,index)=>{
 const form=creatureForm(`${family}-1`)!;
 const at=`2026-10-10T12:0${index}:00.000Z`,owner='trailkeeper.receiz.id';
 const identity=discoverLivingCreature({encounterId:`market:art:fixture:${index}`,form,discoveredAt:at,location:{x:-10+index*23,z:-8+index*14},ownerScope:owner,moment:deriveKaiKlokMoment({occurredAt:at,authority:'world'})});
 const asset=admitLegacyCard(sealDiscoveredCard({identity,formId:form.id,ownerReceizId:owner,capturedAt:at}),at);
 return index!==1?asset:appendLivingCardHistory({asset,event:{eventId:'fixture:earned-training',rulesetVersion:'wildz.progression.v1',occurredAt:'2026-10-10T12:10:00.000Z',source:{mode:'training',activityId:'fixture:training',actorId:owner,authority:'local'},evidence:{},effects:[{kind:'progress',xpDelta:350,growthEvents:[]}]}});
});
