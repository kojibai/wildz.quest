import {NextResponse} from 'next/server';
import {marketFixtureCards} from '@/features/market/market-fixture-cards';
import {renderWildsCardSvg} from '@/features/play/card-export';

export async function GET(_request:Request,context:{params:Promise<{assetId:string}>}){
 if(process.env.NODE_ENV!=='development')return new NextResponse(null,{status:404});
 const {assetId}=await context.params,asset=marketFixtureCards.find(card=>card.id===assetId);
 return asset?new NextResponse(renderWildsCardSvg(asset),{headers:{'content-type':'image/svg+xml','cache-control':'no-store'}}):new NextResponse(null,{status:404});
}
