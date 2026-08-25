"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { WildsPortableClaimPanel, type WildsPortableClaimStatus } from "@/features/play/WildsPortableClaimPanel";
import { authorizeWildsPortableClaimWithIdentity } from "@/features/play/wilds-portable-claim-authorization";
import { decodeWildsPortableClaim, type WildsPortableClaim } from "@/features/play/wilds-portable-claim";
import { defaultIdentityRepository } from "@/lib/receiz/wildz-identity-adapter";

function proofFromHash() {
  const hash = window.location.hash;
  if (!hash.startsWith("#proof=")) throw new Error("wilds_portable_claim_missing");
  return hash.slice("#proof=".length);
}

export default function WildsClaimPage() {
  const [claim, setClaim] = useState<WildsPortableClaim | null>(null);
  const [proof, setProof] = useState("");
  const [status, setStatus] = useState<WildsPortableClaimStatus>("ready");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const encoded = proofFromHash();
      setProof(encoded);
      setClaim(decodeWildsPortableClaim(encoded));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "wilds_portable_claim_invalid");
      setStatus("failed");
    }
  }, []);

  const onClaim = useCallback(async () => {
    if (!claim || status === "claiming" || status === "committed") return;
    setStatus("claiming");
    setError("");
    try {
      let executionProof: unknown = undefined;
      if (claim.carrier.kind === "portable-execution") {
        const identity = await defaultIdentityRepository.active();
        if (!identity?.keyId) throw new Error("receiz_id_required");
        executionProof = await authorizeWildsPortableClaimWithIdentity(identity.keyId, {
          claimId: claim.claimId,
          exactPlanDigest: claim.carrier.exactPlanDigest,
          kind: claim.kind
        });
      }
      const response = await fetch("/api/wilds/claims", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proof, executionProof })
      });
      const result = await response.json().catch(() => null) as { ok?: unknown; error?: unknown; status?: unknown } | null;
      if (!response.ok || result?.ok !== true || result.status !== "committed") {
        throw new Error(typeof result?.error === "string" ? result.error : "wilds_portable_claim_failed");
      }
      setStatus("committed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "wilds_portable_claim_failed");
      setStatus("failed");
    }
  }, [claim, proof, status]);

  return <main className="wilds-portable-claim-page">
    <header><Link href="/">← Return to the Wilds</Link><span>WILDZ · RECEIZ ID</span></header>
    {claim ? <WildsPortableClaimPanel claim={claim} error={error} onClaim={() => void onClaim()} status={status} />
      : <section className="wilds-portable-claim-panel is-failed"><small>PLAYABLE PROOF</small><h1>Claim unavailable</h1><p>{error ? error.replaceAll("_", " ") : "Opening source proof…"}</p></section>}
  </main>;
}
