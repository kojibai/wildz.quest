import {notFound} from 'next/navigation';
import CreationCrewBrowserFixture from '@/features/play/creation/CreationCrewBrowserFixture';
export default function CreationCrewFixturePage(){if(process.env.NODE_ENV==='production')notFound();return <CreationCrewBrowserFixture/>;}
