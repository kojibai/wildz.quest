/** pnpm test first, then node scripts/check-playtest-performance.mjs /path/to/export.json */
import { readFileSync } from 'node:fs';
import { assessWildsPlaytestPerformance } from '../.test-build/src/features/play/wilds-playtest.js';
try {
  if (!process.argv[2]) throw new Error('Usage: node scripts/check-playtest-performance.mjs /path/to/export.json');
  const result = assessWildsPlaytestPerformance(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'pass' ? 0 : result.status === 'fail' ? 1 : 2;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not read playtest evidence.');
  process.exitCode = 2;
}
