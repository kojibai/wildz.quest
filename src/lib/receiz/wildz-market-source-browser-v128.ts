'use client';
import type {openWildsResourcePackageExchangeBrowserV128} from './wilds-resource-exchange-browser-v128';
import {createWildzMarketSourceRepositoryV128,createWildzMarketPublicStoreLocatorV128} from './wildz-market-source-repository-v128';
import type {WildzMarketListingV128,WildzMarketSelectionV128,WildzMarketSourceEventV128} from './wildz-market-source-types-v128';
/** Only call for an explicit market read/action. Reuse the actual registered
 * application/device grant, subject source and SDK authority session; no new
 * identity, native title or financial rail is invented. */
export function openWildzMarketSourceBrowserV128(input:Readonly<{
 resourceRuntime:Awaited<ReturnType<typeof openWildsResourcePackageExchangeBrowserV128>>;
 qualifySelection(selection:WildzMarketSelectionV128):Promise<WildzMarketSelectionV128>;
 verifyTransition(event:Extract<WildzMarketSourceEventV128,{kind:'approved'|'progress'|'terminal-consent'}>,listing:WildzMarketListingV128):Promise<void>;
}>){
 const runtime=input.resourceRuntime;
 const locator=createWildzMarketPublicStoreLocatorV128({sdk:runtime.sdk,authority:runtime.sourceAuthor,sourceUrl:'https://wildz.quest/receiz/market-source-v128'});
 return createWildzMarketSourceRepositoryV128({sdk:runtime.sdk,database:runtime.database,authority:runtime.sourceAuthor,session:runtime.session,locator,
  qualifySelection:input.qualifySelection,verifyTransition:input.verifyTransition});
}
