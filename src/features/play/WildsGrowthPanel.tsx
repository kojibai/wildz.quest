"use client";

import { growthReadiness, nextGrowthRequirements } from "./growth-engine";
import { currentLivingProjection, currentRevision } from "./living-card-proof";
import { isLivingCardAsset, type GrowthPath, type LivingGrowthSnapshot } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";

const PATH_LABELS: Record<GrowthPath, string> = {
  bond: "Bond",
  battle: "Battle",
  exploration: "Explore",
  legacy: "Legacy",
  community: "Community",
  character: "Character"
};

const MISSING_LABELS = {
  bond: "Build the required bond through journeys and care.",
  achievement: "Earn an unused qualifying achievement.",
  character_quest: "Complete this companion's character quest.",
  catalyst: "Earn the required Ascension Catalyst through play.",
  recovery: "Let this companion finish its recovery period."
} as const;

export function WildsGrowthPanel({
  asset,
  progress,
  catalystIds,
  now,
  onAscend
}: {
  asset: PortableCardAsset;
  progress: LivingGrowthSnapshot | null;
  catalystIds: string[];
  now: string;
  onAscend: () => void;
}) {
  if (!isLivingCardAsset(asset) || !progress) {
    return <p className="wilds-growth-legacy">This verified legacy card becomes living when its next earned action is sealed.</p>;
  }

  const projection = currentLivingProjection(asset);
  const revision = currentRevision(asset);
  const requirements = nextGrowthRequirements(asset, now);
  const readiness = growthReadiness(asset, { progress, catalystIds }, now);

  return (
    <section className="wilds-growth-panel" aria-label="Living card growth">
      <header>
        <div><span>Living card · Revision {projection.revision}</span><strong>Stage {projection.stage}{projection.ascensionRank ? ` · Ascension ${projection.ascensionRank}` : ""}</strong></div>
        <b>{progress.bond} bond</b>
      </header>
      <div className="wilds-growth-paths">
        {(Object.entries(progress.paths) as Array<[GrowthPath, number]>).map(([path, value]) => (
          <span key={path}><small>{PATH_LABELS[path]}</small><strong>{value}</strong></span>
        ))}
      </div>
      <div className="wilds-growth-next">
        <span>What remains</span>
        <strong>{requirements.mode === "ascension" ? `Ascension ${requirements.ascensionRank}` : "Next evolution"}</strong>
        <p>{requirements.quest.label}</p>
        {readiness.missing.length ? (
          <ul>{readiness.missing.map((missing) => <li key={missing}>{MISSING_LABELS[missing]}</li>)}</ul>
        ) : <p className="wilds-growth-ready">Every gate is earned. The next form is ready to seal.</p>}
      </div>
      {requirements.mode === "ascension" ? (
        <button className="button button-primary" disabled={!readiness.ready} onClick={onAscend} type="button">
          {readiness.ready ? `Begin Ascension ${requirements.ascensionRank}` : `Ascension ${requirements.ascensionRank} locked`}
        </button>
      ) : null}
      <details>
        <summary>Revision history <span>{asset.manifest.revisions.length} sealed moments</span></summary>
        <ol>{[...asset.manifest.revisions].reverse().map((entry) => (
          <li key={entry.digest}><b>R{entry.revision}</b><span>{entry.reason.label}</span><time dateTime={entry.sealedAt}>{new Date(entry.sealedAt).toLocaleDateString()}</time></li>
        ))}</ol>
      </details>
      <small className="wilds-growth-proof">Append-only proof · {revision.digest.slice(0, 14)}…</small>
    </section>
  );
}
