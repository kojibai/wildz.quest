import type {WildzWalletPresentation} from '../../lib/receiz/wildz-wallet-presentation';

export type WildzMarketHeldDisplayRateBinding=Readonly<Pick<WildzWalletPresentation,'keyId'|'actorId'|'incarnation'>>;
const matches=(binding:WildzMarketHeldDisplayRateBinding,source:WildzMarketHeldDisplayRateBinding)=>
 source.keyId===binding.keyId&&source.actorId===binding.actorId&&source.incarnation===binding.incarnation;

/** Read a display-only scalar from an already admitted local observation.
 * The presentation loader owns admission; this helper opens no source, makes
 * no quote and grants no payment authority. A pending balance refresh can
 * retain an observed rate. Callers must clear fallback on actual revocation. */
export function readWildzMarketHeldDisplayRate(
 binding:WildzMarketHeldDisplayRateBinding|null|undefined,
 presentation:WildzWalletPresentation|null|undefined
):string|null{
 if(!binding?.keyId||!binding.actorId||!binding.incarnation||!presentation||!matches(binding,presentation))return null;
 const observation=presentation.observation;
 if(!observation||observation.schema!=='wildz.wallet.observation.v1'||!matches(binding,observation)
  ||observation.summary.status!=='verified')return null;
 const rate=observation.summary.displayUsdPerPhiMicrocents;
 return typeof rate==='string'&&/^[1-9][0-9]{0,29}$/.test(rate)?rate:null;
}
