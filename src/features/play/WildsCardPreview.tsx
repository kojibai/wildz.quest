"use client";

import { memo } from "react";
import type { AdventureCardCondition } from "./adventure/card-condition";
import { cardDeathRecord } from "./card-death-record";
import { creatureForm } from "./creature-catalog";
import type { PortableCardAsset } from "./portable-card";
import { WildsCreatureThumbnail } from "./WildsCreatureThumbnail";

export const WildsCardPreview = memo(function WildsCardPreview({
  asset,
  condition
}: {
  asset: PortableCardAsset;
  condition?: AdventureCardCondition | null;
}) {
  const form = creatureForm(asset.manifest.formId);
  if (!form) return null;
  const death = cardDeathRecord(asset, condition);

  return (
    <span
      aria-hidden="true"
      className={`wilds-card-preview foil-${form.foil}${death ? " is-dead" : ""}`}
      data-life={death ? "dead" : "alive"}
      style={{
        "--card-preview-accent": asset.manifest.variant.traits.palette.accent,
        "--card-preview-glow": asset.manifest.variant.traits.palette.glow
      } as React.CSSProperties}
    >
      <span className="wilds-card-preview-foil" />
      <span className="wilds-card-preview-head">
        <strong>{asset.manifest.name}</strong>
        <b>STAGE {form.stage}</b>
      </span>
      <WildsCreatureThumbnail asset={asset} />
      <span className="wilds-card-preview-stats">
        <small>{form.rarity}</small>
        <b>{asset.manifest.stats.power} PWR</b>
      </span>
      {death ? <span className="wilds-card-preview-memorial"><small>Memorial</small><strong>Deceased</strong></span> : null}
    </span>
  );
});
