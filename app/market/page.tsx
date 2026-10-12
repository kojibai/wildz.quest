import {WildzApp} from '@/features/shell/WildzApp';
import {publicPageMetadata} from '@/lib/wildz/search-metadata';

export const metadata=publicPageMetadata('Wildz Market','Explore player-owned creatures, discover listings and manage your Wildz trades.','/market');
export default function MarketPage(){return <WildzApp initialOverlay={{kind:'market'}} marketPresentation="page"/>;}
