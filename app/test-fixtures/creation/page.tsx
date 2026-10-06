import { notFound } from 'next/navigation';
import CreationBrowserFixture from '@/features/play/creation/CreationBrowserFixture';
export default function CreationFixturePage(){if(process.env.NODE_ENV==='production')notFound();return <CreationBrowserFixture/>;}
