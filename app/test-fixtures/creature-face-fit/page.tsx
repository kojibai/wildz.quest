import { notFound } from 'next/navigation';
import CreatureFaceFitBrowserFixture from '@/features/play/CreatureFaceFitBrowserFixture';
export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <CreatureFaceFitBrowserFixture />;
}
