import {WildzApp} from '@/features/shell/WildzApp';
import {publicPageMetadata} from '@/lib/wildz/search-metadata';

export const metadata=publicPageMetadata('Wildz Market','Explore player-owned creatures, discover listings and manage your Wildz trades.','/market',{url:'/social/wildz-market-open-graph.jpg',alt:'Wildz Market — Find your legend. Three colorful creature cards against a living forest.'});
export default function MarketPage(){return <WildzApp initialOverlay={{kind:'market'}} marketPresentation="page"/>;}
