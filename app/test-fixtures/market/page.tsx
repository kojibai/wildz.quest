import {notFound} from 'next/navigation';
import {WildzMarketBrowserFixture} from '@/features/market/WildzMarketBrowserFixture';

export default function Page(){
 if(process.env.NODE_ENV!=='development')notFound();
 return <WildzMarketBrowserFixture/>;
}
