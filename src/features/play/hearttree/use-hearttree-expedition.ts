"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PortableCardAsset } from "../portable-card";
import { emptyHearttreeCondition, projectHearttreeCard, type HearttreeCardCondition } from "./card-capability";
import { generateHearttreeExpedition, type HearttreeExpeditionDefinition } from "./expedition-director";
import { createHearttreeRuntime, stepHearttreeRuntime, type HearttreeInput, type HearttreeRuntimeState } from "./runtime";
import { hearttreeTranscript } from "./transcript";

export type HearttreeInputIntent = HearttreeInput extends infer Value ? Value extends HearttreeInput ? Omit<Value, "sequence" | "tick"> : never : never;

function readableError(error: string) {
  if (error.includes("out_of_range")) return "Move closer to the living objective before attuning.";
  if (error.includes("cooldown")) return "That exact card ability is still recovering.";
  if (error.includes("stamina")) return "The active card needs stamina. Switch cards or create breathing room.";
  if (error.includes("master_active")) return "The Root Master still stands. Read its guard and use the right ability.";
  return error.replaceAll("hearttree_", "").replaceAll("_", " ");
}

function readableEvent(event: HearttreeRuntimeState["events"][number]) {
  if (event.kind === "moved") return "Advanced through the living chamber. Position and timing are committed.";
  if (event.kind === "hazard.hit") return `Root surge struck for ${event.amount} damage. Guard, dodge, or switch approach.`;
  if (event.kind === "dodged") return "Perfect evade—the active card crossed the threat window cleanly.";
  if (event.kind === "guarded") return "Guard established. Timing became protection.";
  if (event.kind === "ability.succeeded") return `Ability landed for ${event.amount} power.`;
  if (event.kind === "switched") return event.amount ? "Tactical switch spent one charge under pressure." : "Squad lead changed safely.";
  if (event.kind === "objective.completed") return "Chamber attuned. The Hearttree reshaped the next challenge.";
  return "Extraction secured. Verified replay will determine persistent consequences.";
}

export function useHearttreeExpedition({ cards, conditions, initialSquadAssetIds, onSquadChange }: {
  cards: readonly PortableCardAsset[];
  conditions: Readonly<Record<string, HearttreeCardCondition>>;
  initialSquadAssetIds: readonly string[];
  onSquadChange: (assetIds: string[]) => void;
}) {
  const available = useMemo(() => cards.filter((card) => conditions[card.id]?.life !== "dead"), [cards, conditions]);
  const fallbackId = available[0]?.id;
  const [selectedIds, setSelectedIds] = useState(() => {
    const restored = initialSquadAssetIds.filter((id) => available.some((card) => card.id === id)).slice(0, 3);
    return restored.length ? restored : fallbackId ? [fallbackId] : [];
  });
  const [mortal, setMortal] = useState(false);
  const [mortalAcknowledged, setMortalAcknowledged] = useState(false);
  const [definition, setDefinition] = useState<HearttreeExpeditionDefinition | null>(null);
  const [runtime, setRuntime] = useState<HearttreeRuntimeState | null>(null);
  const [caption, setCaption] = useState("Choose one to three living cards. Their exact abilities and condition shape the expedition.");
  const [paused, setPaused] = useState(false);
  const selectedCards = useMemo(() => selectedIds.map((id) => available.find((card) => card.id === id)).filter((card): card is PortableCardAsset => Boolean(card)), [available, selectedIds]);
  const squad = useMemo(() => selectedCards.map((card) => projectHearttreeCard(card, conditions[card.id] ?? emptyHearttreeCondition(card.id))), [conditions, selectedCards]);

  const toggleCard = useCallback((assetId: string) => {
    setSelectedIds((current) => {
      const next = current.includes(assetId) ? current.filter((id) => id !== assetId) : current.length < 3 ? [...current, assetId] : current;
      if (!next.length) return current;
      onSquadChange(next);
      return next;
    });
  }, [onSquadChange]);

  const begin = useCallback(() => {
    if (!squad.length || (mortal && !mortalAcknowledged)) return;
    const nextDefinition = generateHearttreeExpedition({
      seed: `hearttree-ui:${squad.map((card) => card.proofDigest).join(":")}:${mortal}`,
      squad,
      history: [],
      mortal
    });
    const nextRuntime = createHearttreeRuntime(nextDefinition, squad);
    setDefinition(nextDefinition);
    setRuntime(nextRuntime);
    setCaption(`Entered ${nextDefinition.chambers[0]!.name}. Navigate to the living objective.`);
  }, [mortal, mortalAcknowledged, squad]);

  const onIntent = useCallback((intent: HearttreeInputIntent) => {
    if (paused) return;
    setRuntime((current) => {
      if (!current || ["result", "extracted", "defeated"].includes(current.phase)) return current;
      try {
        const next = stepHearttreeRuntime(current, { ...intent, sequence: current.sequence + 1, tick: current.tick + 1 } as HearttreeInput);
        const last = next.events.at(-1);
        setCaption(last ? readableEvent(last) : `${intent.kind} resolved from the active card's real capability.`);
        return next;
      } catch (error) {
        setCaption(error instanceof Error ? readableError(error.message) : "The Hearttree rejected that action.");
        return current;
      }
    });
  }, [paused]);

  useEffect(() => {
    if (!runtime || paused || ["result", "extracted", "defeated"].includes(runtime.phase)) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea, select, button, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      const moves: Record<string, { x: number; z: number }> = { w: { x: 0, z: -1 }, arrowup: { x: 0, z: -1 }, s: { x: 0, z: 1 }, arrowdown: { x: 0, z: 1 }, a: { x: -1, z: 0 }, arrowleft: { x: -1, z: 0 }, d: { x: 1, z: 0 }, arrowright: { x: 1, z: 0 } };
      if (moves[key]) onIntent({ kind: "move", vector: moves[key]! });
      else if (key === " ") onIntent({ kind: "dodge", vector: { x: 1, z: 0 }, timingOffsetMs: 0 });
      else if (key === "e") onIntent({ kind: "interact" });
      else if (key === "q") onIntent({ kind: "guard", timingOffsetMs: 0 });
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onIntent, paused, runtime]);

  return {
    available, selectedIds, selectedCards, squad, toggleCard,
    mortal, setMortal: (next: boolean) => { setMortal(next); setMortalAcknowledged(false); },
    mortalAcknowledged, setMortalAcknowledged,
    definition, runtime, caption, setCaption, paused, setPaused, begin, onIntent,
    transcript: runtime ? hearttreeTranscript(runtime) : null,
    terminal: Boolean(runtime && ["result", "extracted", "defeated"].includes(runtime.phase))
  };
}
