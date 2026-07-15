"use client";

import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { initialPlayState, restorePlayState } from "./game-state";
import { standaloneCardUrl } from "./card-export";
import type { PortableCardAsset } from "./portable-card";
import { WildsCardScene } from "./WildsCardScene";

export function WildsCardPage({ assetId }: { assetId: string }) {
  const [asset, setAsset] = useState<PortableCardAsset | null>(() => initialPlayState.inventory.find((item) => item.id === assetId) ?? null);
  const [tab, setTab] = useState<"Overview" | "Proof" | "Lineage" | "Offers">("Overview");
  const [qr, setQr] = useState("");
  const [origin, setOrigin] = useState("https://receiz.app");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const restored = restorePlayState(window.localStorage.getItem("receiz:wilds:save:v2"));
    const local = restored.inventory.find((item) => item.id === assetId) ?? null;
    setAsset(local);
    setOrigin(window.location.origin);
    void QRCode.toDataURL(standaloneCardUrl(assetId, window.location.origin), { errorCorrectionLevel: "M", margin: 4, width: 160 }).then(setQr);
    if (local) setLoading(false);
    else void fetch(`/api/cards/${encodeURIComponent(assetId)}`, { signal: controller.signal })
      .then(async (response) => response.ok ? await response.json() as { record?: { asset?: PortableCardAsset } } : null)
      .then((result) => setAsset(result?.record?.asset ?? null))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [assetId]);
  const detail = useMemo(() => {
    if (!asset) return "This proof-sealed card is not stored on this device yet.";
    if (tab === "Proof") return `${asset.proof.kind} · ${asset.proof.digest}`;
    if (tab === "Lineage") return asset.manifest.lineage.parentAssetIds?.length ? `Fusion child of ${asset.manifest.lineage.parentAssetIds.join(" + ")}` : asset.manifest.lineage.previousAssetId ? `Evolved from ${asset.manifest.lineage.previousAssetId}` : "Original capture seal";
    if (tab === "Offers") return "Buy, trade, and multi-card offers settle only after owner acceptance and proof verification.";
    return `${asset.manifest.species} · Stage ${asset.manifest.stage} · Potential ${asset.manifest.variant.traits.potential} · ${asset.manifest.rarity}`;
  }, [asset, tab]);

  return (
    <main className="wilds-public-card-page">
      <Link className="wilds-card-home" href="/#play">← Back to Wilds</Link>
      {asset ? <WildsCardScene asset={asset} origin={origin} qr={qr} /> : <div className="wilds-card-missing"><strong>{loading ? "Resolving verified card…" : "Verified public card unavailable"}</strong><p>{loading ? "Checking its portable proof and public Receiz projection." : "The card may not have been registered from its originating domain yet."}</p></div>}
      <section className="wilds-card-dock" aria-label="Card details and transactions">
        <div className="wilds-card-dock-tabs">{(["Overview", "Proof", "Lineage", "Offers"] as const).map((item) => <button aria-pressed={tab === item} key={item} onClick={() => setTab(item)} type="button">{item}</button>)}</div>
        <p>{detail}</p>
        <div className="wilds-card-dock-actions"><Link href={`/?card=${encodeURIComponent(assetId)}&action=buy#exchange`}>Buy card</Link><Link href={`/?card=${encodeURIComponent(assetId)}&action=offer#exchange`}>Make offer</Link><Link href={`/?card=${encodeURIComponent(assetId)}&action=trade#exchange`}>Propose trade</Link>{qr ? <Link aria-label="Open this standalone card page" className="wilds-card-qr-link" href={standaloneCardUrl(assetId, origin)}><Image alt="QR code for this standalone card page" height={36} src={qr} unoptimized width={36} /></Link> : null}</div>
      </section>
    </main>
  );
}
