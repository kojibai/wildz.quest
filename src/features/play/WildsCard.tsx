"use client";

import { creatureForm } from "./creature-catalog";
import { deriveBirthGenome } from "./heartbound-genome";
import { renderHeartboundSvg } from "./heartbound-renderer";
import { currentLivingGenome } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";

export function WildsCard({ asset, compact = false }: { asset: PortableCardAsset; compact?: boolean }) {
  const form = creatureForm(asset.manifest.formId);
  if (!form) return null;
  const stats = [
    ["Health", asset.manifest.stats.health],
    ["Power", asset.manifest.stats.power],
    ["Guard", asset.manifest.stats.guard],
    ["Speed", asset.manifest.stats.speed],
    ["Bond", asset.manifest.stats.bond]
  ] as const;
  const variant = asset.manifest.variant.traits;
  const genome = isLivingCardAsset(asset)
    ? currentLivingGenome(asset)
    : deriveBirthGenome({ formId: asset.manifest.formId, proofDigest: asset.proof.digest, variant });
  const creatureSvg = renderHeartboundSvg(genome, "card", { width: 640, height: 405, title: asset.manifest.name, fit: "full-body" });
  return (
    <article
      aria-label={`${asset.manifest.name}, Stage ${form.stage}, ${form.rarity} Wilds card`}
      className={`wilds-collectible-card foil-${form.foil}${compact ? " compact" : ""}`}
      style={{ "--card-primary": variant.palette.primary, "--card-accent": variant.palette.accent, "--card-glow": variant.palette.glow, "--card-body-scale": variant.bodyScale, "--card-motion": `${variant.animationMs}ms` } as React.CSSProperties}
    >
      <div className="wilds-card-foil" aria-hidden="true" />
      <header>
        <div><strong>{asset.manifest.name}</strong><span>{form.species}</span></div>
        <div><b>STAGE {form.stage}</b><small>{form.cardNumber}</small></div>
      </header>
      <div className="wilds-card-art heartbound-card-art" dangerouslySetInnerHTML={{ __html: creatureSvg }} />
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
}
