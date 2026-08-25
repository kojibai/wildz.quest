import { Icons } from "@/components/icons";
import type { WildsPortableClaim } from "./wilds-portable-claim";

export type WildsPortableClaimStatus = "ready" | "claiming" | "committed" | "failed";

const KIND_LABEL: Record<WildsPortableClaim["kind"], string> = {
  phi: "Phi settlement",
  resource: "World resource",
  card: "Creature card",
  "creature-custody": "Creature custody",
  "experience-access": "Experience access",
  "world-right": "World right"
};

export function WildsPortableClaimPanel({
  claim,
  error = "",
  onClaim,
  status
}: {
  claim: WildsPortableClaim;
  error?: string;
  onClaim: () => void;
  status: WildsPortableClaimStatus;
}) {
  return <section className={`wilds-portable-claim-panel is-${status}`}>
    <div className="wilds-portable-claim-seal"><Icons.seal size={28} /></div>
    <small>PLAYABLE PROOF · {KIND_LABEL[claim.kind].toUpperCase()}</small>
    <h1>{claim.title}</h1>
    <p>From <strong>@{claim.source.ownerReceizId}</strong>{claim.recipient.handle ? <> for <strong>@{claim.recipient.handle}</strong></> : null}</p>
    <div className="wilds-portable-claim-law">
      <span><i />Source proof verified at claim time</span>
      <span><i />Your Receiz ID executes locally</span>
      <span><i />Global sync follows without blocking</span>
    </div>
    {status === "committed" ? <div className="wilds-portable-claim-complete"><Icons.check size={22} /><strong>Claim committed</strong><span>The source transition is sealed to your Receiz ID.</span></div>
      : <button disabled={status === "claiming"} onClick={onClaim} type="button">{status === "claiming" ? "Claiming from source…" : "Claim into your Receiz ID"}</button>}
    {error ? <p aria-live="polite" className="wilds-portable-claim-error">{error.replaceAll("_", " ")}</p> : null}
    <footer>The URL carries the proof. It never outranks the sealed source.</footer>
  </section>;
}
