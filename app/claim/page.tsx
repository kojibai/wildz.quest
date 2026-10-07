"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { WildsPortableClaimPanel, type WildsPortableClaimStatus } from "@/features/play/WildsPortableClaimPanel";
import { authorizeWildsPortableClaimWithIdentity } from "@/features/play/wilds-portable-claim-authorization";
import { decodeWildsPortableClaim, type WildsPortableClaim } from "@/features/play/wilds-portable-claim";
import { defaultIdentityRepository } from "@/lib/receiz/wildz-identity-adapter";
import { authorizeWildsWalletReadWithIdentity } from "@/features/play/wallet/wilds-wallet-read-authorization";
import { wildsResourcePackageTitle } from "@/features/play/wilds-resource-package";

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
      } else if(claim.carrier.kind === "bearer-resource-package") {
        const identity=await defaultIdentityRepository.active();
        if(!identity?.keyId || !await authorizeWildsWalletReadWithIdentity(identity.keyId,undefined,"artifact-claim"))throw Error("receiz_id_required");
      }
      const response = await fetch("/api/wilds/claims", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proof, executionProof })
      });
      const result = await response.json().catch(() => null) as { ok?: unknown; error?: unknown; message?: unknown; status?: unknown } | null;
      if (!response.ok || result?.ok !== true || result.status !== "committed") {
        throw new Error(typeof result?.message === "string" ? result.message : typeof result?.error === "string" ? result.error : "wilds_portable_claim_failed");
      }
      setStatus("committed");
    } catch (cause) {
      const code=cause instanceof Error ? cause.message : "wilds_portable_claim_failed";
      setError(code==="receiz_conditional_resource_custody_unavailable"
        ? "Resource exchange is waiting for the shared inventory service. Your proof remains saved; try again when exchange is available."
        : code==="receiz_id_required" || code==="wilds_resource_package_authority_required"
          ? "Open Wildz and sign in with your Receiz ID, then reopen this resource proof."
          : code);
      setStatus("failed");
    }
  }, [claim, proof, status]);
  const resourcePackage=claim?.carrier.kind==="bearer-resource-package"?claim.carrier.offer.package:null;

  return <main className="wilds-portable-claim-page">
    <header><Link href="/">← Return to the Wilds</Link><span>WILDZ · RECEIZ ID</span></header>
    {claim ? <WildsPortableClaimPanel claim={claim} error={error} onClaim={() => void onClaim()} status={status} />
      : <section className="wilds-portable-claim-panel is-failed"><small>PLAYABLE PROOF</small><h1>Claim unavailable</h1><p>{error ? error.replaceAll("_", " ") : "Opening source proof…"}</p></section>}
    {resourcePackage ? <section className="wilds-portable-claim-panel">
      <h2>Resource contents</h2>
      <ul>{resourcePackage.members.map(member=><li key={member.id}>{wildsResourcePackageTitle({...resourcePackage,members:[member]})}</li>)}</ul>
      <p>{status==="committed" ? "Your resource card is admitted to your Receiz ID. Open the Satchel to unpack and use its contents." : "Claiming verifies the original gathers and reserves this exact package to your Receiz ID."}</p>
      <Link href="/">Open Wildz Satchel →</Link>
    </section> : null}
  </main>;
}
