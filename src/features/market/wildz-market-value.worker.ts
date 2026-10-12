import {createWildzMarketValuePortV129, type WildzMarketValueEvaluationV129} from './wildz-market-value-v129';
import {readWildzMarketPublicValueSourceV129} from '../../lib/receiz/wildz-market-public-value-source-v129';
import type {PortableCardAsset} from '../play/portable-card';

/** A one-read worker holds only public card/proof bytes. It receives no signing
 * key, account state, bearer, session, payment or source-authoring capability. */
const scope = self as unknown as {
  addEventListener(type:'message',listener:(event:MessageEvent)=>void):void;
  postMessage(value:unknown):void;
};
let running = false;
scope.addEventListener('message', event => {
  if (running) return;
  const request = event.data as {type?: unknown; assetId?: unknown; card?: PortableCardAsset; evaluation?: WildzMarketValueEvaluationV129};
  if (request?.type !== 'read-value' || typeof request.assetId !== 'string' || !request.card || !request.evaluation) return;
  running = true;
  const assetId = request.assetId, card = request.card, evaluation = request.evaluation;
  const port = createWildzMarketValuePortV129({
    resolveSource: id => readWildzMarketPublicValueSourceV129(id, card),
    evaluation: () => evaluation,
  });
  void port.read(assetId).then(result => scope.postMessage({type:'value-result', result}), () => {
    scope.postMessage({type:'value-result', result:{status:'unavailable', message:'The public proof value could not be checked.'}});
  });
});
