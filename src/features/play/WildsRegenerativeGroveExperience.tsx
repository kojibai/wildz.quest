"use client";

import type { WildsGroveActionKind, WildsRegenerativeGroveV1 } from "./wilds-regenerative-grove";

export type WildsGroveExperienceAction = Readonly<{
  action: WildsGroveActionKind;
  valid: boolean;
  reason: string | null;
  consequence: string;
  amountPhiMicro: string;
}>;

function actionLabel(action: WildsGroveActionKind) {
  return ({
    observe: "Listen to the grove",
    gather: "Gather what has fallen",
    pollinate: "Carry the bloom",
    sow: "Sow new life",
    water: "Water the roots",
    compost: "Feed the soil",
    cultivate: "Tend the growth",
    "transform-nectar": "Turn nectar to honey",
    "harvest-honey": "Share the honey",
    "build-hive": "Raise a living hive",
    "build-nursery": "Build a nursery",
    repair: "Mend what is worn"
  } satisfies Record<WildsGroveActionKind, string>)[action];
}

function phiLabel(amountPhiMicro: string) {
  const amount = BigInt(amountPhiMicro);
  if (amount === 0n) return null;
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `Φ${whole}${fraction ? `.${fraction}` : ""}`;
}

function conditionCue(grove: WildsRegenerativeGroveV1) {
  if (grove.ecology.moisture < 30) return "The roots are thirsty.";
  if (grove.ecology.soil < 35) return "The soil feels thin beneath the flowers.";
  if (grove.restorationDebt > 0) return "This place remembers what was taken.";
  if (grove.ecology.flowers > grove.ecology.pollinators * 3) return "The bloom is waiting for more wings.";
  return "The grove is breathing steadily.";
}

export function WildsRegenerativeGroveExperience({
  open,
  grove,
  companion,
  actions,
  busyAction,
  reconnecting,
  error,
  onAction,
  onExit
}: {
  open: boolean;
  grove: WildsRegenerativeGroveV1;
  companion: Readonly<{ name: string; willing: boolean; energy: number; fatigue: number }> | null;
  actions: readonly WildsGroveExperienceAction[];
  busyAction: WildsGroveActionKind | null;
  reconnecting: boolean;
  error: string | null;
  onAction(action: WildsGroveActionKind): void;
  onExit(): void;
}) {
  if (!open) return null;
  const weather = grove.weather.precipitation.kind === "none"
    ? `${grove.weather.temperatureBand} ${grove.weather.season}`
    : `${grove.weather.precipitation.kind} · ${grove.weather.season}`;
  return <section className="wilds-grove-experience" role="dialog" aria-modal="true" aria-labelledby="wilds-grove-title">
    <header className="wilds-grove-header">
      <div>
        <span className="wilds-grove-eyebrow">{weather} · living grove</span>
        <h2 id="wilds-grove-title">{conditionCue(grove)}</h2>
        <p>{companion
          ? companion.willing
            ? `${companion.name} is ready to work beside you.`
            : `${companion.name} stays close, but does not wish to work right now.`
          : "Some work here needs a willing creature beside you."}</p>
      </div>
      <button className="wilds-grove-close" type="button" aria-label="Return to the world" onClick={onExit}>×</button>
    </header>

    <div className="wilds-grove-vitals" aria-label="Living grove condition">
      <span><b>{grove.ecology.moisture}</b> moisture</span>
      <span><b>{grove.ecology.soil}</b> soil</span>
      <span><b>{grove.ecology.flowers}</b> flowers</span>
      <span><b>{grove.ecology.pollinators}</b> pollinators</span>
    </div>

    {reconnecting ? <p className="wilds-grove-reconnecting" role="status">Holding this work safely while its exact result reconnects.</p> : null}
    {error ? <p className="wilds-grove-error" role="alert">{error}</p> : null}

    <div className="wilds-grove-actions" aria-busy={busyAction !== null}>
      {actions.map((item) => {
        const phi = phiLabel(item.amountPhiMicro);
        const busy = busyAction === item.action;
        return <button
          className="wilds-grove-action"
          disabled={!item.valid || busyAction !== null}
          key={item.action}
          onClick={() => onAction(item.action)}
          type="button"
        >
          <span className="wilds-grove-action-copy">
            <strong>{busy ? "Working together…" : actionLabel(item.action)}</strong>
            <small>{item.valid ? item.consequence : item.reason}</small>
          </span>
          {phi ? <span className="wilds-grove-phi" aria-label={`${phi} possible lawful yield`}>{phi}</span> : null}
        </button>;
      })}
    </div>

    <footer className="wilds-grove-materials">
      <span>{grove.materials.seeds} seeds</span>
      <span>{grove.materials.fallenFiber} fallen fiber</span>
      <span>{grove.materials.nectar} nectar</span>
      <span>{grove.materials.honey} honey</span>
    </footer>
  </section>;
}
