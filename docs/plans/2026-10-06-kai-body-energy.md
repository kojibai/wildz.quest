# Kai breathing and embodied energy

Approved outcome: breaths happen with every Kai pulse, online and offline. Gameplay records successful work within those breaths. The character retains a body condition across daily cycles, while ordinary exploration and creature commands remain available at exhaustion. The model adds meaningful reasons for shelter, sleep and companionship without an action-token breath budget.

## Clock and storage

The existing exact Kai day and pulse law remain authoritative. No missing-breath list, daily timer, online heartbeat persistence or external service is introduced. Read-only presentation advances from one checkpoint: last Kai micro-pulse, previous activity, fuel, immediate strain, fatigue, cumulative effort, today's effort, fractional carries and current-pulse workload. One analytical prefix/suffix handles any number of day boundaries. Daily effort resets at rollover; the body does not.

One actual global pulse means one breath. The day is precisely 17,491.270421 pulses; the nominal 17,491 allocation remains available, while the display counts actual boundaries (17,491 or 17,492 in a particular Kai day). No rounding changes the klok.

The strict v2 checkpoint accepts intact v1 predecessors. Migration creates a successor and preserves their fuel. Existing fixed-point reserve names and food units are retained internally for proof compatibility; the HUD describes readiness, strain and fatigue rather than treating them as clock breaths. Food restores fuel and cannot erase sleep debt.

## Body and game balance

These are deterministic game values, not clinical measurements. Fuel, strain and fatigue are independently bounded. Available energy is the minimum of fuel percentage, 100 minus strain, and 100 minus 90% of fatigue. Tired begins below 60%; low below 20%; exhausted at 10% or less.

- Quiet awake metabolism uses 5% of fuel per Kai day. Being awake adds 120 percentage points of fatigue per day. Camp halves that fatigue rate; it does not replace sleep. Bed sleep removes 300 points per day, so an eight-hour-scale sleep restores a typical waking day's fatigue.
- Calm activity eases strain by 0.35 points per pulse; camp by 1; bed by 1.5. Real work adds 0.75 strain points and about 0.002 fatigue points per effort unit, using retained exact integer carries. Work uses about 0.05% fuel per unit.
- Walking records 0.03 effort units per world metre; running 0.09; upward work 0.2 per metre. Only resolved movement counts. Swimming adds 2 units per elapsed pulse, powered flight 3, gliding 0.5. Failed actions and blocked movement add no effort.
- Successful training adds 3 effort units and requires 20% readiness. Capture adds 1. Directing a creature adds small effort (0.15 per field slot, 0.25 for an offensive battle command, 0.15 for assisting creature world work). Creatures retain their own condition and work consequences. Their commands remain usable when the explorer is exhausted and do not interrupt bed rest.
- Below 20% readiness, running becomes gentle walking. Walking remains possible at zero energy. Flight needs 20% readiness for takeoff, grounded gliding 30%; an airborne switch to glide remains available for a safe return. Aerial endurance cannot recover above current body readiness. Existing landing and underwater depth rules remain in force.

The character inhales and exhales once per Kai pulse with the existing cadence. Tired posture is subtle; sleep retains the full bed pose. Rendering interpolates locally and does not write body checkpoints. On visibility/pagehide, actual swim/flight effort settles once and the suspended scene adopts quiet breathing; it does not invent offline movement. Bed/camp recovery remains active.

## Validation

Regression coverage checks exact pulse boundaries, offline inference, rollover accounting, fractional split invariance, workload within one pulse, saturation, legacy proof preservation, nourishment, sustainable walking, exhaustion consequences, bed recovery and safe flight fallback. The live browser fixture uses real bed construction sources with a manual elapsed-time control; it is inaccessible in production. Fun and pacing still need human playtesting across devices; automated qualification cannot establish subjective enjoyment or zero latency.
