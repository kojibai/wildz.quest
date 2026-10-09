# Embodied movement audio

The existing music, ambience, proof signature, and action cues stay intact. Optional mono MP3 recordings add surface footsteps, animal movement, nearby creature calls, and movement from visible real players. The player's actual travelled distance triggers steps; camera orientation and three-dimensional distance determine stereo direction and attenuation. Stationary actors do not generate walking loops.

The planner samples at 8 Hz after the world is playable and audio has been unlocked, checks at most 64 visible sources, and retains the nearest eight. There are at most four additional decoded voices. Small samples load sequentially through the existing background scheduler. Missing/offline samples are skipped without waiting or synthesizing fallback noise. Already loaded recordings stay in the existing audio service-worker cache. Muting, hiding the document, opening an exclusive panel, and disposal stop optional voices; resume resets movement history so there is no catch-up burst. None of this reads proof history or requests identity authority.

A single 12 ms landing haptic uses the existing capability-checked vibration helper, is suppressed with reduced motion, and is not repeated for footsteps. Safari on iPhone/iPad does not expose arbitrary navigator.vibrate patterns; those devices retain audio/visual feedback without hidden-control haptic workarounds.

## Water and mountain movement

Swimming uses actual three-dimensional travelled distance, with an 800 ms minimum interval, and never probes the floor for its strokes. Submerged listeners hear a very quiet water texture at long intervals; land birds and creature calls are suppressed underwater. Mode changes, diving, teleportation, and resuming do not replay accumulated movement. Steep rock terrain that already declares a climbing requirement selects the dry climbing contact sample. These additions keep the existing two-sounds-per-tick and four-voice limits.

The water state and body depth come from the existing aquatic and vertical traversal projections. Canopy classification is memoized rather than rescanning the site list for every surface contact. Terrain lookup occurs only when an actual ground contact is due. No movement, collision, terrain geometry, or proof transition is changed.

## Recordings and licenses

All new assets are CC0, trimmed, faded at their boundaries, converted to mono 22.05 kHz MP3 at 40 kbit/s, and stored under immutable content-digest filenames. Exact SHA-256 values and provenance are in public/audio/wildz/catalog.json. The 14 encoded samples total 56,469 bytes. Peaks are normalized to −8 dBFS (−10 dBFS for the bird) before the quiet runtime gains are applied.

- TinyWorlds, [Different steps on wood, stone, leaves, gravel and mud](https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud): grass/leaves, soil, gravel trail, stone, timber steps, and a short gravel-contact variation for steep mountain climbing. Original field recordings from pdsounds.org, edited for Minetest.
- ezwa, submitted by qubodup, [6 short water splashes](https://opengameart.org/content/6-short-water-splashes): wading steps and filtered swimming/underwater textures. The two swimming variations are low-pass-filtered splash recordings, not hydrophone recordings.
- syncopika, [Bird chirping sounds](https://opengameart.org/content/bird-chirping-sounds): a short backyard bird recording.
- mikeask, [Some animal noise](https://opengameart.org/content/some-animal-noise): a performed fictional creature call, used for companion creatures. Goats and hares use body movement sounds rather than inaccurate species calls.

License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## Verification

The production Chromium check fetched zero audio samples during startup, decoded all 14 optional recordings after a user gesture, produced surface contacts while walking, stopped sampling and voices while hidden, and resumed with playable controls and no loading screen. The measured 8 Hz callback had a 0.215 ms p95 and 0.255 ms maximum in that desktop sample. These are not installed iPhone PWA measurements. Swimming, climbing, underwater source filtering, and discontinuity behavior are covered by planner tests. See [the combined verification report](../performance/2026-10-09-panel-audio-and-seal.md).
