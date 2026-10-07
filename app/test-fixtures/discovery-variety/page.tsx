import {notFound} from 'next/navigation';
import DiscoveryVarietyBrowserFixture from '@/features/play/DiscoveryVarietyBrowserFixture';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <DiscoveryVarietyBrowserFixture/>;}
