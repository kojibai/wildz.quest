import type {PortableCardAsset} from "./portable-card";
import type {WildsCrewMode} from "./wilds-crew-preferences";

export type WildsCrewFilter = "all" | "with-you" | "roaming";
export type WildsCrewSort = "collection" | "name" | "newest";
export const WILDS_CREW_PAGE_SIZE = 12;
const nameOrder = new Intl.Collator("en", {numeric:true,sensitivity:"base"});
function searchable(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}

/** Presentation-only index. Its exact admitted card references and IDs remain
 * unchanged; this browser never admits a card or issues a crew command. */
export function indexWildsCrewCards(cards:readonly PortableCardAsset[]){
  return cards.map(card=>({card,searchText:searchable(`${card.manifest.name} ${card.manifest.species} ${card.manifest.rarity}`)}));
}

export function browseWildsCrewCards(input:Readonly<{
  entries:ReturnType<typeof indexWildsCrewCards>;
  query:string;
  filter:WildsCrewFilter;
  sort:WildsCrewSort;
  modes:Readonly<Record<string,WildsCrewMode>>;
  accompanyingAssetIds:readonly string[];
  page:number;
}>){
  const tokens=searchable(input.query).trim().split(/\s+/).filter(Boolean),withYou=new Set(input.accompanyingAssetIds);
  const cards=input.entries.filter(({card,searchText})=>tokens.every(token=>searchText.includes(token))
    && (input.filter==="all" || input.filter==="with-you" && withYou.has(card.id) || input.filter==="roaming" && input.modes[card.id]==="roam"))
    .map(({card})=>card);
  if(input.sort==="name")cards.sort((a,b)=>nameOrder.compare(a.manifest.name,b.manifest.name) || a.id.localeCompare(b.id));
  else if(input.sort==="newest")cards.sort((a,b)=>b.manifest.capturedAt.localeCompare(a.manifest.capturedAt) || a.id.localeCompare(b.id));
  const pageCount=Math.max(1,Math.ceil(cards.length/WILDS_CREW_PAGE_SIZE));
  const page=Math.max(0,Math.min(Number.isFinite(input.page)?Math.floor(input.page):0,pageCount-1));
  return {cards:cards.slice(page*WILDS_CREW_PAGE_SIZE,(page+1)*WILDS_CREW_PAGE_SIZE),total:cards.length,page,pageCount,
    first:cards.length?page*WILDS_CREW_PAGE_SIZE+1:0,last:Math.min(cards.length,(page+1)*WILDS_CREW_PAGE_SIZE)};
}
