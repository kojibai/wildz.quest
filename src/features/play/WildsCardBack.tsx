"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { portableCardPngBlob, readPortableCardFromPng, type PortableCardPngProof } from "./card-export";
import { projectLivingCardDossier } from "./living-card-dossier";
import type { PortableCardAsset } from "./portable-card";

function label(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function downloadText(value: string, filename: string) {
  const url = URL.createObjectURL(new Blob([value], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function WildsCardBack({ asset, origin, qr }: { asset: PortableCardAsset; origin: string; qr: string }) {
  const dossier = useMemo(() => projectLivingCardDossier(asset, origin), [asset, origin]);
  const [copyStatus, setCopyStatus] = useState("");
  const [pngProof, setPngProof] = useState<PortableCardPngProof | null>(null);
  const [generatingPngProof, setGeneratingPngProof] = useState(false);

  return (
    <article aria-label="Living card back" className="wilds-card-back">
      <div className="wilds-card-back-scroll">
        <header>
          <div><span>Living companion dossier</span><strong>{asset.manifest.name}</strong></div>
          <b>{asset.manifest.rarity} · Stage {asset.manifest.stage}</b>
        </header>

        <section className="wilds-card-back-story">
          <span>Character story</span>
          <p>{dossier.story}</p>
        </section>

        <section>
          <h2>Personality</h2>
          <div className="wilds-dossier-tags">{dossier.personality.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
          <dl>
            <div><dt>Home signal</dt><dd>{dossier.personality.habitat}</dd></div>
            <div><dt>Communication</dt><dd>{dossier.personality.communication}</dd></div>
            <div><dt>Motivations</dt><dd>{dossier.personality.motivations.join(" ")}</dd></div>
            <div><dt>Bonding</dt><dd>{dossier.personality.bonding.join(" ")}</dd></div>
            <div><dt>Care cues</dt><dd>{dossier.personality.careCues.join(" ")}</dd></div>
            <div><dt>Quirks</dt><dd>{dossier.personality.quirks.join(" ")}</dd></div>
          </dl>
        </section>

        <section>
          <h2>Gameplay intelligence</h2>
          <strong className="wilds-dossier-role">{dossier.gameplay.role}</strong>
          <div className="wilds-dossier-stat-grid">{Object.entries(dossier.gameplay.stats).map(([name, value]) => <span key={name}><small>{label(name)}</small><b>{value}</b></span>)}</div>
          <dl>
            <div><dt>Abilities</dt><dd>{dossier.gameplay.abilities.join(" · ")}</dd></div>
            <div><dt>Strengths</dt><dd>{dossier.gameplay.strengths.join(" · ")}</dd></div>
            <div><dt>Needs support</dt><dd>{dossier.gameplay.vulnerabilities.join(" · ")}</dd></div>
            <div><dt>Team fit</dt><dd>{dossier.gameplay.teammates.join(" ")}</dd></div>
            <div><dt>Next growth</dt><dd>{dossier.gameplay.nextRequirements.join(" ")}</dd></div>
          </dl>
        </section>

        <section>
          <h2>Full visual DNA</h2>
          <code>{dossier.dna.identityFingerprint}</code>
          <dl>
            <div><dt>Face</dt><dd>{dossier.dna.face.join(" · ")}</dd></div>
            <div><dt>Body</dt><dd>{dossier.dna.body.join(" · ")}</dd></div>
            <div><dt>Appendages</dt><dd>{dossier.dna.appendages.join(" · ")}</dd></div>
            <div><dt>Markings</dt><dd>{dossier.dna.markings.join(" · ")}</dd></div>
            <div><dt>Aura</dt><dd>{dossier.dna.aura.join(" · ")}</dd></div>
            <div><dt>Behavior</dt><dd>{dossier.dna.behavior.join(" · ")}</dd></div>
            <div><dt>Versions</dt><dd>Genome {dossier.dna.generatorVersion} · Renderer {dossier.dna.rendererVersion}</dd></div>
          </dl>
        </section>

        <section>
          <h2>Lineage</h2>
          <dl>
            <div><dt>Root</dt><dd>{dossier.lineage.root}</dd></div>
            <div><dt>Parents</dt><dd>{dossier.lineage.parents.length ? dossier.lineage.parents.join(" + ") : "Original sealed companion"}</dd></div>
            <div><dt>Children</dt><dd>{dossier.lineage.children.length ? dossier.lineage.children.join(" · ") : "No recorded descendants yet"}</dd></div>
          </dl>
        </section>

        <details className="wilds-card-proof-dossier">
          <summary>Complete offline proof <span>{dossier.verification.ok ? "All checks pass" : "Review errors"}</span></summary>
          <div className="wilds-proof-checks">{dossier.verification.checks.map((check) => <div key={check.label} data-status={check.status}><b>{check.status === "pass" ? "✓" : "!"}</b><span><strong>{check.label}</strong><small>{check.detail}</small></span></div>)}</div>
          <dl>
            <div><dt>Verification route</dt><dd>{dossier.verification.route}</dd></div>
            <div><dt>Proof kind</dt><dd>{asset.proof.kind}</dd></div>
            <div><dt>Canonicalization</dt><dd>{asset.proof.canonicalization}</dd></div>
            <div><dt>Sealed</dt><dd>{asset.proof.sealedAt}</dd></div>
          </dl>
          <pre aria-label="Complete canonical card proof">{dossier.canonicalProofJson}</pre>
          {pngProof ? <dl className="wilds-png-proof-meta"><div><dt>PNG schema</dt><dd>{pngProof.schema}</dd></div><div><dt>PNG image digest</dt><dd>{pngProof.imageDigest}</dd></div></dl> : null}
          <div className="wilds-card-proof-actions">
            <button onClick={async () => {
              try {
                await navigator.clipboard.writeText(dossier.canonicalProofJson);
                setCopyStatus("Canonical proof copied.");
              } catch {
                setCopyStatus("Copy was blocked. Use Download canonical proof instead.");
              }
            }} type="button">Copy canonical proof</button>
            <button onClick={() => downloadText(dossier.canonicalProofJson, `${asset.manifest.formId}-proof.json`)} type="button">Download canonical proof</button>
            <button disabled={generatingPngProof} onClick={async () => {
              setGeneratingPngProof(true);
              try {
                const blob = await portableCardPngBlob(asset);
                setPngProof(readPortableCardFromPng(new Uint8Array(await blob.arrayBuffer())));
                setCopyStatus("Exact PNG proof metadata generated from the rendered pixels.");
              } catch {
                setCopyStatus("PNG proof metadata could not be generated on this device.");
              } finally {
                setGeneratingPngProof(false);
              }
            }} type="button">{generatingPngProof ? "Generating…" : "Generate exact PNG proof metadata"}</button>
          </div>
          <p aria-live="polite">{copyStatus}</p>
        </details>

        <footer>
          <div><span>Proof-sealed living character</span><code>{asset.proof.digest}</code></div>
          {qr ? <Link aria-label="Open this exact standalone card page" className="wilds-card-back-qr" href={dossier.verification.route}><Image alt="QR code for this exact standalone card page" height={60} src={qr} unoptimized width={60} /></Link> : null}
        </footer>
      </div>
    </article>
  );
}
