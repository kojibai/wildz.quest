import { Icons } from "@/components/icons";

export function WildsVerifiedBadge() {
  return <span aria-label="Receiz verified" className="wilds-creature-verified" role="img" title="Receiz verified">
    <Icons.check aria-hidden="true" size={9} strokeWidth={4} />
  </span>;
}
