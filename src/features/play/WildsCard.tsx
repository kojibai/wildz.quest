"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { creatureForm } from "./creature-catalog";
import { deriveBirthGenome } from "./heartbound-genome";
import { renderHeartboundSvg } from "./heartbound-renderer";
import { currentLivingGenome } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import { cardDeathRecord } from "./card-death-record";
import type { AdventureCardCondition } from "./adventure/card-condition";
import type { PortableCardAsset } from "./portable-card";
import { creatureConsciousnessMotion } from "./creature-consciousness";

export const WildsCard = memo(function WildsCard({ asset, compact = false, condition, speaking = false }: { asset: PortableCardAsset; compact?: boolean; condition?: AdventureCardCondition | null; speaking?: boolean }) {
  const card = useRef<HTMLElement>(null);
  const form = creatureForm(asset.manifest.formId);
  const variant = asset.manifest.variant.traits;
  const creatureSvg = useMemo(() => renderHeartboundSvg(
    isLivingCardAsset(asset)
      ? currentLivingGenome(asset)
      : deriveBirthGenome({ formId: asset.manifest.formId, proofDigest: asset.proof.digest, variant }),
    "card",
    { width: 640, height: 405, title: asset.manifest.name, fit: "full-body" }
  ), [asset, variant]);
  const death = cardDeathRecord(asset, condition);
  const stats = [
    ["Health", asset.manifest.stats.health],
    ["Power", asset.manifest.stats.power],
    ["Guard", asset.manifest.stats.guard],
    ["Speed", asset.manifest.stats.speed],
    ["Bond", asset.manifest.stats.bond]
  ] as const;
  useEffect(() => {
    const reset = () => card.current?.style.setProperty("--creature-mouth-open", "0");
    const onMouthMotion = (event: Event) => {
      const detail = (event as CustomEvent<{ assetId?: string; openness?: number }>).detail;
      if (detail?.assetId !== asset.id) return;
      card.current?.style.setProperty("--creature-mouth-open", String(Math.max(0, Math.min(1, detail.openness ?? 0))));
    };
    window.addEventListener("wildz-creature-mouth", onMouthMotion);
    if (!speaking) reset();
    return () => {
      window.removeEventListener("wildz-creature-mouth", onMouthMotion);
      reset();
    };
  }, [asset.id, speaking]);
  if (!form) return null;
  return (
    <article
      aria-label={`${asset.manifest.name}, Stage ${form.stage}, ${form.rarity} Wilds card`}
      className={`wilds-collectible-card foil-${form.foil}${compact ? " compact" : ""}${death ? " is-dead" : ""}`}
      data-conscious="true"
      data-speaking={speaking ? "true" : "false"}
      ref={card}
      style={{ "--card-primary": variant.palette.primary, "--card-accent": variant.palette.accent, "--card-glow": variant.palette.glow, "--card-body-scale": variant.bodyScale, "--card-motion": `${variant.animationMs}ms`, ...creatureConsciousnessMotion(asset, condition?.fatigue ?? 0) } as React.CSSProperties}
    >
      <div className="wilds-card-foil" aria-hidden="true" />
      <header>
        <div><strong>{asset.manifest.name}</strong><span>{form.species}</span></div>
        <div><b>STAGE {form.stage}</b><small>{form.cardNumber}</small></div>
      </header>
      <div aria-label={`${asset.manifest.name} is alive on the card face${speaking ? " and speaking" : ""}`} className="wilds-card-art heartbound-card-art" dangerouslySetInnerHTML={{ __html: creatureSvg }} />
      {death ? <div className="wilds-card-death-mark"><span>Memorial</span><strong>Deceased</strong></div> : null}
      <div className="wilds-card-rarity"><span>{form.rarity}</span><b>{form.foil}</b></div>
      <dl className="wilds-card-stats">
        {stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="wilds-card-abilities">
        {form.abilities.map((ability) => <div key={ability.name}><strong>{ability.name}</strong><b>{ability.power}</b><p>{ability.text}</p></div>)}
      </div>
      <footer>
        <span>{asset.status.replace("_", " ")}</span>
        <code title={asset.proof.digest}>{asset.proof.digest.slice(7, 19)}</code>
      </footer>
    </article>
  );
});
