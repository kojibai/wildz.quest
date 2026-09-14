# Restored Vault, construction, and motion fixes

The earlier performance pass is committed separately as `1276d01`.

## Changes

- Suppress selection, native context menus, and image dragging at the app root, including public profiles and portal overlays. Keep typing, scrolling, and pointer movement intact. No per-frame selection work.
- Admit crew control from exact cards covered by a verified Identity snapshot or V3 binding. Preserve original ownership. Reopen retained seal evidence after reload. Cache custody checks only for exact immutable admitted cards; mutable and changed cards still require checking.
- Publish collected cards under the collector's signed profile namespace, preserving the creator's card proof. Read that namespace before canonical fallback. Show the current verified public revision with an explicit notice if the profile's pinned revision is older.
- Losslessly compress public card transport with bounded decoding. Preserve legacy transport reads. Signing/compression runs through the existing worker. Stop duplicating raw assets alongside signed transport.
- Add solid walls, window walls, pitched roofs, gables, full-storey stair flights, stairwell floors, and beams with recipes, work plans, support anchors, collision geometry, weather cover, and placement controls.
- Show one custom-building map marker per project, excluding underground pieces. Default one-finger/left-drag map gesture pans; two fingers zoom/rotate; right drag rotates.
- Update world rebase and trainer/remote/encounter poses before HTML label projection. Smooth follower facing and avoid per-frame winged ground/air toggling. Limit visual gait to two cycles per second without changing physical travel speed.

## Evidence

- `pnpm test`: 2,688 passing, no failures.
- Actual supplied seal: V3 binding verified locally, 42 cards, all 42 eligible for crew control. Private key material was not logged or transmitted.
- Public profile audit: 8 missing public card records and 7 differing revisions. All eight missing collected-card proofs subsequently published successfully using the SDK. MCP by-URL confirmed the recovered collection record for Onoafug.
- Original signed upload for Onoafug was rejected at 3,731,305 bytes. Lossless compact transport published successfully without dropping history.
- Regression tests cover signed collection scope, rejection of unrelated/mutated cards, immutable custody reuse, compression round trip and bounds, walkable 0.25m stair rises, stairwell clearance at four rotations, 1,000 pieces grouped into one map marker, and frame ordering before labels.
- Selection browser check: profile contextmenu/selectstart/dragstart canceled, no selected text, editable field typing passed and field selection collapsed. Real iOS native behavior still needs device verification.

## QA references

Loaded debug-profiler, gameplay-systems, game-ui-designer, playwright, and qa-release skills. Loaded QA release, visual verification, playtest, release, HUD readability, responsive fit, mobile input, and game UI checklists. Existing deterministic collision system retained; no engine or audio changes.

## Limits

These changes require the user's push/deployment before the live website can decode the new collection records. Tests establish the covered behavior; they do not guarantee zero latency or every native browser gesture on every device. Advanced construction is an extension of the existing authored piece system, not arbitrary mesh editing. Existing build warnings concerning a fixture image and StewardEnvironment dependency remain unrelated.

## Final production check

- Final full suite: 2,688/2,688 passed. Production build passed. Architecture lock: 764 runtime files. Secret scan: 1,590 files. SDK v126 check passed.
- All eight recovered collection image endpoints returned HTTP 200, SVG content, approximately 31–33 KB each in the final local production app.
- Warm movement: 487 frames, p95 17.5 ms, maximum 19.385 ms, zero browser long tasks. Earlier first-run pointer sample contained a 2,096 ms stall; its cause was not established and the warm run does not eliminate that residual concern.
- Mobile screenshot reviewed: `/private/tmp/wildz-final-mobile.png` (390×844). No horizontal overflow; visible companion name and HUD fit. Console contained four expected local wallet-authority 401s, no observed rendering exception.
- Physical iOS long-press and broad multiplayer network-jitter validation remain device/environment checks. No universal zero-hitch claim is made.
