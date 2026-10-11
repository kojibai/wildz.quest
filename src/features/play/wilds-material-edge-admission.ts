import type {WildsWorldOutboxEntry} from './wilds-world-outbox';
import type {WildsWorldProjection} from './wilds-world-state';
import type {WildsWorldEvent} from './wilds-world-event';
/** Transient callback contract. Only beforeAdmit may establish a first dispatch;
 * beforeApply is read-only authorization and must run before local effects. */
export type WildsMaterialAdmissionFence=((entry:WildsWorldOutboxEntry)=>Promise<void>) & {
 beforeApply?:(entry:WildsWorldOutboxEntry)=>Promise<void>;
};
export type WildsOrdinaryMaterialAdmission=Readonly<{
 ordinary:true;entry:WildsWorldOutboxEntry;projection:WildsWorldProjection;events:readonly WildsWorldEvent[];beforeAdmit:()=>Promise<void>;afterAdmit:()=>Promise<void>;
}>;
/** A transient native-to-local handoff, never stored in continuity or a proof.
 * Failure leaves the exact durable material checkpoint available for recovery. */
export async function persistWildsOrdinaryMaterialAdmission(input:{
 admission:WildsOrdinaryMaterialAdmission;persist:(entry:WildsWorldOutboxEntry)=>Promise<void>;
 restore:()=>Promise<unknown>;capture:(entry:WildsWorldOutboxEntry)=>Promise<void>;
 apply:(projection:WildsWorldProjection,events:readonly WildsWorldEvent[])=>WildsWorldProjection;
 onAdmitted?:(projection:WildsWorldProjection,events:readonly WildsWorldEvent[])=>void;
}){
 const {admission}=input;
 await admission.beforeAdmit();
 await input.restore();
 await admission.beforeAdmit();
 await input.persist(admission.entry);
 await admission.beforeAdmit();
 const applied=input.apply(admission.projection,admission.events);
 input.onAdmitted?.(applied,admission.events);
 await input.capture(admission.entry);
 await admission.beforeAdmit();
 await admission.afterAdmit();
 return applied;
}
