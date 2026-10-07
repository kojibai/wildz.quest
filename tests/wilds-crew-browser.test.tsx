import assert from "node:assert/strict";
import {test} from "node:test";
import {renderToStaticMarkup} from "react-dom/server";
import {browseWildsCrewCards,indexWildsCrewCards,WILDS_CREW_PAGE_SIZE} from "../src/features/play/wilds-crew-browser";
import {sealCollectedCard,type PortableCardAsset} from "../src/features/play/portable-card";
import {WildsCrewPanel} from "../src/features/play/WildsCrewPanel";
import {WildsCrewCreatureControls} from "../src/features/play/WildsCrewCreatureControls";
import {renderPortableCreatureThumbnail} from "../src/features/play/WildsCreatureThumbnail";

function collection(count:number){
  return Array.from({length:count},(_,index)=>({id:`crew-${index}`,manifest:{name:`Creature ${index}`,species:index%2?"Tide guardian":"Grove companion",rarity:index%3?"trail":"rare",capturedAt:new Date(Date.UTC(2026,9,7,12,index)).toISOString()}} as PortableCardAsset));
}
function options(cards:readonly PortableCardAsset[]){return {entries:indexWildsCrewCards(cards),query:"",filter:"all" as const,sort:"collection" as const,modes:{},accompanyingAssetIds:[],page:0};}

test("large crew pagination reaches every exact creature once and clamps after a collection shrinks",()=>{
  const cards=collection(1003),input=options(cards),ids:string[]=[];
  for(let page=0;page<Math.ceil(cards.length/WILDS_CREW_PAGE_SIZE);page++){
    const result=browseWildsCrewCards({...input,page});
    assert.ok(result.cards.length<=12);ids.push(...result.cards.map(card=>card.id));
    assert.equal(result.cards[0],cards[page*12]);
  }
  assert.deepEqual(ids,cards.map(card=>card.id));
  const shrunk=browseWildsCrewCards({...options(cards.slice(0,2)),page:99});
  assert.equal(shrunk.page,0);assert.equal(shrunk.pageCount,1);assert.deepEqual(shrunk.cards,cards.slice(0,2));
  assert.equal(browseWildsCrewCards({...input,page:-3}).page,0);
});

test("crew search matches case-insensitive name, species and rarity together and clearing restores the collection",()=>{
  const cards=collection(54),input=options(cards);
  const result=browseWildsCrewCards({...input,query:"  CREATURE 12 grove RARE ",page:99});
  assert.deepEqual(result.cards,[cards[12]]);assert.equal(result.page,0);assert.equal(result.total,1);
  const empty=browseWildsCrewCards({...input,query:"no matching creature",page:3});
  assert.equal(empty.total,0);assert.equal(empty.first,0);assert.equal(empty.last,0);assert.equal(empty.page,0);
  assert.equal(browseWildsCrewCards({...input,query:" "}).total,54);
});

test("crew filters preserve eligibility, exact cards and mode semantics without adding stale accompanying IDs",()=>{
  const cards=collection(40),input={...options(cards),accompanyingAssetIds:[cards[2]!.id,cards[31]!.id,"not-in-eligible-crew"],modes:{[cards[3]!.id]:"roam" as const,[cards[31]!.id]:"follow" as const}};
  assert.deepEqual(browseWildsCrewCards({...input,filter:"with-you"}).cards,[cards[2],cards[31]]);
  assert.deepEqual(browseWildsCrewCards({...input,filter:"roaming"}).cards,[cards[3]]);
  assert.deepEqual(browseWildsCrewCards({...input,filter:"with-you",query:"31"}).cards,[cards[31]]);
  assert.equal(browseWildsCrewCards({...input,filter:"all"}).total,cards.length);
});

test("name and newest browsing sort a copy while keeping exact creature references",()=>{
  const cards=collection(30),snapshot=[...cards],input=options(cards);
  const named=browseWildsCrewCards({...input,sort:"name"});
  assert.deepEqual(named.cards.map(card=>card.id),cards.slice(0,12).map(card=>card.id));
  const newest=browseWildsCrewCards({...input,sort:"newest"});
  assert.equal(newest.cards[0],cards[29]);assert.deepEqual(cards,snapshot);
});

test("the paw panel shows bounded actual identity portraits with search, filters and direct page navigation",()=>{
  const cards=Array.from({length:25},(_,index)=>sealCollectedCard({formId:"mintcub-1",ownerReceizId:"crew-owner",encounterId:`crew-portrait-${index}`,capturedAt:new Date(Date.UTC(2026,9,7,12,index)).toISOString()}));
  const html=renderToStaticMarkup(<WildsCrewPanel cards={cards} modes={{}} accompanyingAssetIds={[cards[0]!.id]} onModeChange={()=>{}} />);
  assert.match(html,/Search creature crew/);assert.match(html,/Filter creature crew/);assert.match(html,/Sort creature crew/);
  assert.match(html,/Crew page/);assert.match(html,/Next crew page/);assert.match(html,/1–12 of 25/);
  assert.equal((html.match(/data-identity-signature=/g)??[]).length,12);
  assert.doesNotMatch(html,/<canvas/);
  const exact=renderPortableCreatureThumbnail(cards[0]!);
  assert.ok(html.includes(exact));
  const cardHtml=renderToStaticMarkup(<WildsCrewCreatureControls card={cards[0]!} accompanying onModeChange={()=>{}} />);
  assert.ok(cardHtml.includes(exact));assert.match(cardHtml,/With you/);assert.match(cardHtml,/Follow \/ recall/);assert.match(cardHtml,/Roam &amp; explore/);
});

test("empty eligible crew stays a useful empty state without fake selectable creatures",()=>{
  const html=renderToStaticMarkup(<WildsCrewPanel cards={[]} modes={{}} accompanyingAssetIds={["stale"]} onModeChange={()=>{}} />);
  assert.match(html,/Find a creature to start your crew/);assert.doesNotMatch(html,/data-identity-signature=|Follow \/ recall/);
});
