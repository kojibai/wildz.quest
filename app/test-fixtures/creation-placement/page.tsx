import { notFound } from 'next/navigation';
import CreationPlacementBrowserFixture from '@/features/play/creation/CreationPlacementBrowserFixture';

export default function CreationPlacementFixturePage() {
  if (process.env.NODE_ENV !== 'development' && process.env.WILDZ_ENABLE_TEST_FIXTURES !== '1') notFound();
  return <CreationPlacementBrowserFixture />;
}
