import {notFound} from 'next/navigation';
import CampaignPressureBrowserFixture from '@/features/play/fixtures/CampaignPressureBrowserFixture';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <CampaignPressureBrowserFixture/>;}
