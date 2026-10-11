import {notFound} from 'next/navigation';
import BuildingClearanceBrowserFixture from '@/features/play/BuildingClearanceBrowserFixture';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <BuildingClearanceBrowserFixture/>;}
