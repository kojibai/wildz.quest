import { notFound } from 'next/navigation';
import CreationMaterialsBrowserFixture from '@/features/play/creation/CreationMaterialsBrowserFixture';
export default function CreationMaterialsFixturePage(){if(process.env.NODE_ENV==='production')notFound();return <CreationMaterialsBrowserFixture/>;}
