"use client";

import type { CSSProperties } from "react";
import { Icons } from "@/components/icons";
import type {
  WildsCommandAction,
  WildsCommandCategory,
  WildsCommandCenterModel,
  WildsCommandPriority
} from "./director";
import { WildsKaiMomentInspector } from "./WildsKaiMomentInspector";

const actionLabels: Record<WildsCommandAction["type"], string> = {
  "open-mission": "Open mission",
  "open-field-guide": "Open Field Guide",
  "open-satchel": "Open Satchel",
  "open-trail-pack": "Open Trail Pack",
  "open-vault": "Open Card Vault",
  "open-map": "Open world atlas",
  "activate-context": "Execute nearby action"
};

function CommandAction({ action, onAction }: {
  action: WildsCommandAction | null;
  onAction: (action: WildsCommandAction) => void;
}) {
  if (!action) return <span className="wilds-neural-unavailable">Observe only</span>;
  return <button onClick={() => onAction(action)} type="button">
    <span>{actionLabels[action.type]}</span>
    <Icons.chevronRight aria-hidden="true" size={15} />
  </button>;
}

function Branch({ category, label, priorities, onAction }: {
  category: WildsCommandCategory | "world-network";
  label: string;
  priorities: readonly WildsCommandPriority[];
  onAction: (action: WildsCommandAction) => void;
}) {
  const visible = priorities.slice(0, 2);
  return <section className={`wilds-neural-branch is-${category}`} aria-label={`${label} command signals`}>
    <span aria-hidden="true" className="wilds-neural-path"><i /></span>
    <header><span>{label}</span><b>{String(visible.length).padStart(2, "0")}</b></header>
    {visible.length ? visible.map((item) => <article data-urgency={item.urgency} key={item.id}>
      <span className="wilds-neural-node" aria-hidden="true" />
      <div><small>{item.urgency}</small><strong>{item.title}</strong><p>{item.consequence}</p></div>
      <CommandAction action={item.action} onAction={onAction} />
    </article>) : <p className="wilds-neural-quiet">No active signal. The branch is listening.</p>}
  </section>;
}

export function WildsCommandCenter({ model, onAction }: {
  model: WildsCommandCenterModel;
  onAction: (action: WildsCommandAction) => void;
}) {
  const style = {
    "--kai-accent": model.palette.primary,
    "--kai-hue": String(model.palette.hue),
    "--kai-sides": String(model.palette.sides),
    "--kai-step-progress": String(model.moment.stepPctAcrossBeat),
    "--kai-pulse-progress": String(model.moment.percentIntoPulse)
  } as CSSProperties;
  const squad = model.priorities.filter((item) => item.category === "squad" || item.category === "battle" || item.category === "system");
  const world = model.priorities.filter((item) => item.category === "world" || item.category === "multiplayer");
  const mission = model.priorities.filter((item) => item.category === "mission");

  return <div
    className="wilds-neural-command"
    data-connection={model.connection}
    data-kai-authority={model.moment.authority}
    data-kai-chakra={model.moment.chakra}
    data-now-urgency={model.now.urgency}
    style={style}
  >
    <div aria-hidden="true" className="wilds-neural-field"><i /><i /><i /></div>
    <div aria-hidden="true" className="wilds-neural-spine"><i /><i /><i /><b /></div>

    <header className="wilds-command-telemetry">
      <div><small>Kai Klok world coordinate</small><strong>{model.moment.latticeCoordinate}</strong></div>
      <div className="wilds-command-eternal"><WildsKaiMomentInspector moment={model.moment} /></div>
      <div className="wilds-command-calendar"><span>Y{model.moment.year}</span><span>M{model.moment.month}</span><span>D{model.moment.day}</span><span>W{model.moment.week}</span></div>
      <div className="wilds-command-chakra"><i aria-hidden="true" /><span><small>{model.moment.weekday}</small><strong>{model.moment.chakra} · {model.moment.gate}</strong></span></div>
      <span className="wilds-command-authority">{model.moment.authority === "local" ? "Local continuity" : "Shared world coordinate"} · {model.connection}</span>
    </header>

    <section className="wilds-command-now" aria-labelledby="wilds-command-now-title" data-urgency={model.now.urgency}>
      <span className="wilds-neural-now-orbit" aria-hidden="true"><i /><i /><i /></span>
      <div><small>Now · {model.now.urgency} · causal {model.causalId.slice(-8)}</small><h4 id="wilds-command-now-title">{model.now.title}</h4><p>{model.now.consequence}</p></div>
      <CommandAction action={model.now.action} onAction={onAction} />
    </section>

    <div className="wilds-command-branches">
      <Branch category="squad" label="Squad" priorities={squad} onAction={onAction} />
      <Branch category="world-network" label="World" priorities={world} onAction={onAction} />
      <Branch category="mission" label="Mission" priorities={mission} onAction={onAction} />
    </div>

    <footer className="wilds-command-coordinate"><span>36 beats</span><i /><span>44 steps</span><i /><span>11 pulses</span><strong>{model.moment.coordinate}</strong></footer>
    <p aria-live="polite" className="sr-only">{model.isNew ? `${model.now.title}. ${model.now.consequence}` : ""}</p>
  </div>;
}
