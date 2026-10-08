import { notFound } from 'next/navigation';
import { AmbientLifeBrowserFixture } from '@/features/play/AmbientLifeBrowserFixture';

export default function Page() {
  if (process.env.NODE_ENV !== 'development' && process.env.WILDZ_ENABLE_TEST_FIXTURES !== '1') notFound();
  return <AmbientLifeBrowserFixture />;
}
