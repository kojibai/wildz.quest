import type {ReceizPortableSealedArtifactV124} from '@receiz/sdk';
import type {WildsWalletAssetSendAsset} from '../../features/play/wallet/wilds-wallet-asset-send';
import type {WildsWalletStagedTradeSourceHead} from '../../features/play/wallet/wilds-wallet-staged-trade-types';

/** An advertisement and device-authored source journal never replace native
 * asset custody or payment receipts. Both are independently admitted privately. */
export type WildzMarketSelectionV128=Readonly<{
 asset:WildsWalletAssetSendAsset;semanticIds:readonly string[];sourceDigest:string;
 summary:string;resourceUnits:number;creatureCount:number;
}>;
export type WildzMarketPhaseV128='reserved'|'approved'|'payment-pending'|'paid'|'asset-pending'|'asset-accepted'|'completed'|'cancelled';
export type WildzMarketReservationV128=Readonly<{
 reservationId:string;listingId:string;listingHead:string;reservationHead:string;
 buyerHandle:string;sellerHandle:string;priceUsdCents:number;phase:WildzMarketPhaseV128;
 quoteDigest?:string;planDigest?:string;amountPhiMicro?:string;sourceHead?:WildsWalletStagedTradeSourceHead;
 approvalDigest?:string;paymentReceiptDigest?:string;assetReceiptDigest?:string;
 terminalConsent?:Readonly<{outcome:'completed'|'zero-write';planDigest:string;approvalDigest:string;paymentReceiptDigest:string|null;assetReceiptDigest:string|null;zeroWriteReceiptDigest:string|null;actors:readonly string[]}>;
}>;
export type WildzMarketListingV128=Readonly<{
 listingId:string;sellerHandle:string;selection:WildzMarketSelectionV128;priceUsdCents:number;
 listingHead:string;status:'active'|'reserved'|'cancelled'|'sold';reservation:WildzMarketReservationV128|null;
}>;
export type WildzMarketSourceStateV128=Readonly<{
 schema:'wildz.market-source-state.v128';listings:Readonly<Record<string,WildzMarketListingV128>>;
 semanticLocks:Readonly<Record<string,string>>;terminalOrder:readonly string[];
}>;
export type WildzMarketSourceArchiveReferenceV128=Readonly<{digest:string;count:number}>;
export type WildzMarketSourceProofV128=Readonly<{
 schema:'wildz.market-source-proof.v128';custodyArtifact:ReceizPortableSealedArtifactV124;
 archivePages:readonly WildzMarketSourceArchiveReferenceV128[];sourceArtifacts:readonly ReceizPortableSealedArtifactV124[];
}>;
export type WildzMarketSourceEventV128=Readonly<{
 schema:'wildz.market-source-command.v128';attemptId:string;actorHandle:string;
} & (
 {kind:'list';listingId:string;selection:WildzMarketSelectionV128;priceUsdCents:number} |
 {kind:'cancel';listingId:string;expectedListingHead:string} |
 {kind:'reserve';listingId:string;expectedListingHead:string;reservationId:string} |
 {kind:'release';listingId:string;reservationId:string;expectedReservationHead:string} |
 {kind:'approved';listingId:string;reservationId:string;expectedReservationHead:string;quoteDigest:string;planDigest:string;amountPhiMicro:string;sourceHead:WildsWalletStagedTradeSourceHead;approvalDigest:string} |
 {kind:'terminal-consent';listingId:string;reservationId:string;expectedReservationHead:string;outcome:'completed'|'zero-write';planDigest:string;approvalDigest:string;paymentReceiptDigest:string|null;assetReceiptDigest:string|null;zeroWriteReceiptDigest:string|null} |
 {kind:'progress';listingId:string;reservationId:string;expectedReservationHead:string;phase:'payment-pending'|'paid'|'asset-pending'|'asset-accepted';receiptDigest?:string}
)>;
export type WildzMarketSourceSnapshotV128=Readonly<{
 state:WildzMarketSourceStateV128;head:string|null;proof:WildzMarketSourceProofV128|null;
}>;
export type WildzMarketSourceResultV128=Readonly<{
 snapshot:WildzMarketSourceSnapshotV128;listing:WildzMarketListingV128;
 receiptLocator:Readonly<{schema:'wildz.market-source-locator.v128';domainId:string;head:string;sourceArtifactSha256:string;appendId:string}>;
}>;
export type WildzMarketSourceRepositoryV128=Readonly<{
 load():Promise<WildzMarketSourceSnapshotV128>;
 /** Qualify current private native/resource source before signing an advertisement. */
 list(input:Readonly<{attemptId:string;listingId:string;selection:WildzMarketSelectionV128;priceUsdCents:number}>):Promise<WildzMarketSourceResultV128>;
 cancel(input:Readonly<{attemptId:string;listingId:string;expectedListingHead:string}>):Promise<WildzMarketSourceResultV128>;
 reserve(input:Readonly<{attemptId:string;listingId:string;expectedListingHead:string;reservationId:string}>):Promise<WildzMarketSourceResultV128>;
 transition(event:WildzMarketSourceEventV128):Promise<WildzMarketSourceResultV128>;
 /** Current SDK source read; never treats a peer progress message as acceptance. */
 observe(input:Readonly<{listingId:string;reservationId?:string}>):Promise<WildzMarketSourceResultV128>;
 verifyReservation(input:Readonly<{listingId:string;reservationId:string;buyerHandle:string;sellerHandle:string;priceUsdCents:number;listingHead:string}>):Promise<WildzMarketSourceResultV128>;
}>;
