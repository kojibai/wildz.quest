import type { playerBreathReadout } from "../player-breath-energy";

type BodyReadout = ReturnType<typeof playerBreathReadout>;
const modeLabels: Record<BodyReadout["mode"], string> = {
  active: "Awake", camp: "Resting at camp", bed: "Sleeping in bed",
  sleep: "Sleeping here",
  swim: "Swimming", flight: "Flying", glide: "Gliding"
};

export function WildsBodyReadout({ body, onOpenSatchel, onSleep, onWake }: { body: BodyReadout; onOpenSatchel?: () => void; onSleep?: () => void; onWake?: () => void }) {
  const limits = [
    { label: "Fuel", readiness: body.fuelPercent },
    { label: "Strain", readiness: 100 - body.strainPercent },
    { label: "Fatigue", readiness: 100 - .9 * body.fatiguePercent }
  ].sort((left, right) => left.readiness - right.readiness);
  const limiting = limits[0]!.label;
  return <section className="wilds-body-readout" aria-label="Live explorer energy" data-body-mode={body.mode}>
    <header><span><small>Explorer energy</small><strong>{modeLabels[body.mode]} · {body.condition}</strong></span><b>{body.energyPercent.toFixed(1)}%</b></header>
    <div className="wilds-body-energy-bar" role="progressbar" aria-label="Explorer readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(body.energyPercent.toFixed(1))} aria-valuetext={`${body.energyPercent.toFixed(1)}% ready; ${limiting.toLowerCase()} is the limiting factor`}>
      <i style={{ width: `${body.energyPercent}%` }} />
    </div>
    <p className="wilds-body-limiting">{limiting} currently sets your readiness.</p>
    <dl>
      <div><dt>Fuel</dt><dd>{body.fuelPercent.toFixed(1)}%</dd><p>Your reserve for work. Camp and nourishment replenish it.</p></div>
      <div><dt>Strain</dt><dd>{body.strainPercent.toFixed(1)}%</dd><p>Recent exertion. Quiet time eases it; camp and bed rest ease it faster.</p></div>
      <div><dt>Fatigue</dt><dd>{body.fatiguePercent.toFixed(1)}%</dd><p>Longer weariness. Being awake adds it slowly; sleep restores it, faster in bed.</p></div>
    </dl>
    <div className="wilds-body-breaths"><strong>{body.remainingDayBreaths.toLocaleString("en-US")} breaths left this Kai day</strong><span>{body.elapsedBreaths.toLocaleString("en-US")} elapsed · {body.effortToday.toFixed(1)} effort today</span></div>
    <p>Breaths follow every Kai pulse, including time away. Readiness reflects what your body did during those breaths. A new day renews the breath cycle, while fuel and fatigue carry forward.</p>
    <p>Chilling can raise readiness as strain settles. Camp restores fuel. Sleep anywhere to restore deeper fatigue; a usable bed offers better recovery. Moving wakes you.</p>
    {onOpenSatchel ? <button onClick={onOpenSatchel} type="button">Open Satchel</button> : null}
    {(body.mode === 'sleep' || body.mode === 'bed') && onWake ? <button onClick={onWake} type="button">Wake up</button> : onSleep ? <button onClick={onSleep} type="button">Sleep here</button> : null}
  </section>;
}
