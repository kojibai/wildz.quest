import { notFound } from 'next/navigation';
import CreationBedReloadBrowserFixture from '@/features/play/creation/CreationBedReloadBrowserFixture';
export default function Page(){
  if(process.env.NODE_ENV!=='development')notFound();
  return <CreationBedReloadBrowserFixture/>;
}
