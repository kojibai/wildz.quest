/** Scheduling grace lets a newly published route reach the physical renderer before
 * a persistent movement/readiness pause becomes an explicit blocked observation. */
export const WILDS_CREW_PAUSE_GRACE_MS = 2000;
export function observeWildsCrewTravelPause(previous:number|undefined,paused:boolean,hasPosition:boolean,now:number):{since:number|undefined;blocked:boolean} {
  if(!paused||!hasPosition||!Number.isFinite(now))return {since:undefined,blocked:false};
  const since=previous!==undefined&&Number.isFinite(previous)&&previous<=now?previous:now;
  return {since,blocked:now-since>=WILDS_CREW_PAUSE_GRACE_MS};
}
