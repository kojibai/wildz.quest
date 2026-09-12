# Card publication retry recovery

## Root cause and change

A cancelled upload could remain in the shared in-flight registration map indefinitely when its asynchronous body preparation did not settle. The waiting caller rejected, but later retries reused the stuck promise. That could block standalone cards and the profile publication that waits for them.

The owning request's abort signal now also retires the shared registration. A check after body preparation prevents a delayed, cancelled operation from uploading after a retry takes over. Secondary callers still cancel only their own wait. Verification, signed-owner authority, and publication confirmation remain required.

## Evidence

The new regression test failed before the change with `stalled` instead of `published`. Afterward all 12 card-session tests passed, including independent caller cancellation, revision deduplication, and signed-publication fallback. The test releases the delayed serializer and verifies that only the fresh retry reaches the registry.

Full verification: 2,253 tests passed across 206 suites; production build and TypeScript checking passed; targeted ESLint passed; secret scan passed. The build retains two pre-existing warnings in BuildGuidanceBrowserFixture and WildsStewardEnvironment.

This is a reproducible retry-lifecycle fix, not evidence that bjklock's original seal encountered this exact failure. Original-seal live publication and browser frame-time profiling remain outstanding; no FPS improvement is claimed.

## Reference ledger

Read: threejs-debug-profiler/SKILL.md, references/debug-profile-checklists.md, references/checklists/performance-profile.md; superpowers/systematic-debugging/SKILL.md; superpowers/verification-before-completion/SKILL.md. This slice resolves a request lifecycle failure. Renderer profiling and mobile visual verification are not claimed.
