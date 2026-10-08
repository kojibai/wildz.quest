import { notFound } from 'next/navigation';
import { WorldWorkerBrowserFixture } from '@/features/play/WorldWorkerBrowserFixture';

export default function Page() {
  if (process.env.NODE_ENV !== 'development' && process.env.WILDZ_ENABLE_TEST_FIXTURES !== '1') notFound();
  return <WorldWorkerBrowserFixture />;
}
