import type { WildzMarketListingV128 } from "./wildz-market-source-types-v128";
import type { PortableCardAsset } from "../../features/play/portable-card";
import { wildzMarketValueSameProofCardV129 } from "./wildz-market-public-value-source-v129";

type Listing = Pick<WildzMarketListingV128, "sellerHandle" | "status" | "selection">;
type Certificate = Readonly<{ card: PortableCardAsset; sourceDigest: string }>;

/** Display issuance guard only. The caller must already have independently
 * admitted the native listing and verified both the complete public root and
 * its separate native projection certificate. Native listing law is unchanged. */
export function wildzMarketValueListingBindsCardV129(listing: Listing, publisherHandle: string, card: PortableCardAsset, certificate?: Certificate): boolean {
  return listing.sellerHandle === publisherHandle
    && listing.selection.asset.kind === "creature"
    && listing.selection.asset.assetId === card.id
    && !!certificate && /^[a-f0-9]{64}$/.test(certificate.sourceDigest)
    && wildzMarketValueSameProofCardV129(card, certificate.card)
    && listing.selection.sourceDigest === certificate.sourceDigest
    && (listing.status === "active" || listing.status === "reserved");
}
