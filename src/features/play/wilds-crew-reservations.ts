/** Scheduling reservations are intents, never material custody or proof authority.
 * Admission still verifies every exact lot against the current world head. */
export type WildsCrewReservation = Readonly<{ jobId: string; workerId: string; lotId: string }>;
export type WildsCrewReservations = Readonly<Record<string, WildsCrewReservation>>;
export function reserveWildsCrewLots(current: WildsCrewReservations, request: Readonly<{jobId:string;workerId:string;lotIds:readonly string[]}>) {
  if(!request.jobId || !request.workerId || !request.lotIds.length || request.lotIds.length>64 || new Set(request.lotIds).size!==request.lotIds.length)
    return {ok:false as const, reason:'invalid-request' as const, reservations:current};
  if(request.lotIds.some(id=>!id || (Object.hasOwn(current, id) && (current[id].jobId!==request.jobId || current[id].workerId!==request.workerId))))
    return {ok:false as const, reason:'reserved' as const, reservations:current};
  const next: Record<string, WildsCrewReservation> = Object.assign(Object.create(null), current);
  for(const lotId of request.lotIds) next[lotId]={jobId:request.jobId,workerId:request.workerId,lotId};
  return {ok:true as const,reservations:next};
}
export function releaseWildsCrewReservations(current:WildsCrewReservations,jobId:string) {
  const next: Record<string, WildsCrewReservation> = Object.assign(Object.create(null), current);
  for(const [id,reservation] of Object.entries(next)) if(reservation.jobId===jobId) delete next[id];
  return next;
}
export function reconcileWildsCrewReservations(current:WildsCrewReservations,liveJobs:ReadonlySet<string>,availableLots:ReadonlySet<string>) {
  return Object.fromEntries(Object.entries(current).filter(([id,reservation])=>liveJobs.has(reservation.jobId)&&availableLots.has(id)));
}
