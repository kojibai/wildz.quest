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
    "harvest-honey": "Collect Living Honey",
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
  collectedHoney = false,
  onAction,
  onOpenWallet,
  onExit
}: {
  open: boolean;
  grove: WildsRegenerativeGroveV1;
  companion: Readonly<{ name: string; willing: boolean; energy: number; fatigue: number }> | null;
  actions: readonly WildsGroveExperienceAction[];
  busyAction: WildsGroveActionKind | null;
  reconnecting: boolean;
  error: string | null;
  collectedHoney?: boolean;
  onAction(action: WildsGroveActionKind): void;
  onOpenWallet?(): void;
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

    <div className="wilds-grove-honey-guide">
      <strong>Living Honey · Wallet Resources</strong>
      <p>Needs a living hive, 1 honey in the grove, and a willing companion.</p>
      <small>Listen to the grove → Gather what has fallen → Carry the bloom → Turn nectar to honey → Raise a living hive → Collect Living Honey.</small>
      <small>Gathering gives pollen and fallen fiber. Carry the bloom uses 1 pollen to make 2 nectar; turn 2 nectar into 2 honey; raise a hive with 2 fallen fiber.</small>
    </div>

    {collectedHoney ? <div className="wilds-grove-honey-collected">
      <p role="status">1 Living Honey collected. Find it in Wallet → Resources.</p>
      {onOpenWallet ? <button className="wilds-grove-action" onClick={onOpenWallet} type="button">View Wallet Resources</button> : null}
    </div> : null}

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
      <span>{grove.materials.pollen} pollen</span>
      <span>{grove.materials.seeds} seeds</span>
      <span>{grove.materials.fallenFiber} fallen fiber</span>
      <span>{grove.materials.nectar} nectar</span>
      <span>{grove.materials.honey} honey in grove</span>
      <span>{grove.structures.hive} living {grove.structures.hive === 1 ? "hive" : "hives"}</span>
    </footer>
  </section>;
}
