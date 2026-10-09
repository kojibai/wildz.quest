# Embodied movement audio

The existing music, ambience, proof signature, and action cues stay intact. Optional mono MP3 recordings add surface footsteps, animal movement, nearby creature calls, and movement from visible real players. The player's actual travelled distance triggers steps; camera orientation and three-dimensional distance determine stereo direction and attenuation. Stationary actors do not generate walking loops.

Ground contacts use half the previous maximum gain (at least 6 dB quieter). A small smoothed speed readout makes slow walking softer, keeps running slightly fuller, and adds restrained contact-to-contact variation. Nearby player and animal contacts use the same quieter mix and distance attenuation. This reuses the existing 8 Hz positions and clock; cadence, source limits, swimming textures, calls, and other audio groups are unchanged.

The planner samples at 8 Hz after the world is playable and audio has been unlocked, checks at most 64 visible sources, and retains the nearest eight. There are at most four additional decoded voices. Small samples load sequentially through the existing background scheduler. Missing/offline samples are skipped without waiting or synthesizing fallback noise. Already loaded recordings stay in the existing audio service-worker cache. Muting, hiding the document, opening an exclusive panel, and disposal stop optional voices; resume resets movement history so there is no catch-up burst. None of this reads proof history or requests identity authority.

A single 12 ms landing haptic uses the existing capability-checked vibration helper, is suppressed with reduced motion, and is not repeated for footsteps. Safari on iPhone/iPad does not expose arbitrary navigator.vibrate patterns; those devices retain audio/visual feedback without hidden-control haptic workarounds.

## Water and mountain movement

Swimming uses actual three-dimensional travelled distance, with an 800 ms minimum interval, and never probes the floor for its strokes. Submerged listeners hear a very quiet water texture at long intervals; land birds and creature calls are suppressed underwater. Mode changes, diving, teleportation, and resuming do not replay accumulated movement. Steep rock terrain that already declares a climbing requirement selects the dry climbing contact sample. These additions keep the existing two-sounds-per-tick and four-voice limits.

The water state and body depth come from the existing aquatic and vertical traversal projections. Canopy classification is memoized rather than rescanning the site list for every surface contact. Mountain skins use the existing admitted site spatial index, ahead of underlying procedural grass; built floors still take precedence. Surface lookup occurs only when an actual ground contact is due. No movement, collision, terrain geometry, or proof transition is changed.

## Flying and gliding

One continuous wind voice fades in over 160 ms and out over 120 ms on landing. The existing 8 Hz sampler uses actual three-dimensional body travel to smooth volume and pitch; powered flight is slightly fuller than glide. Teleportation and resume reset velocity. Ongoing flight updates the same source and gain nodes, with 90 ms parameter smoothing, instead of starting a new sound on every contact. It shares the same four-voice ceiling with the other optional sounds and respects ambience volume, mute, panel ownership, visibility, and disposal.

Grass recordings are preprocessed with a 2.2 kHz low-pass, 16 ms onset fade, and 35 ms release fade. Their peaks are 4 dB below the previous files, in addition to the quieter contact mix. This adds no runtime filter nodes; the two replacement files have the same encoded byte counts. Previous immutable grass files remain available for older PWA clients; no audio cache or durable proof storage is cleared.

## Recordings and licenses

All new assets are CC0, trimmed, faded at their boundaries, converted to mono 22.05 kHz MP3 at 40 kbit/s, and stored under immutable content-digest filenames. Exact SHA-256 values and provenance are in public/audio/wildz/catalog.json. The 15 encoded samples total 84,777 bytes. Peaks are normalized to −8 dBFS (−10 dBFS for the bird; −12 dBFS for grass) before the quiet runtime gains are applied.

- TinyWorlds, [Different steps on wood, stone, leaves, gravel and mud](https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud): grass/leaves, soil, gravel trail, stone, timber steps, and a short gravel-contact variation for steep mountain climbing. Original field recordings from pdsounds.org, edited for Minetest.
- ezwa, submitted by qubodup, [6 short water splashes](https://opengameart.org/content/6-short-water-splashes): wading steps and filtered swimming/underwater textures. The two swimming variations are low-pass-filtered splash recordings, not hydrophone recordings.
- syncopika, [Bird chirping sounds](https://opengameart.org/content/bird-chirping-sounds): a short backyard bird recording.
- mikeask, [Some animal noise](https://opengameart.org/content/some-animal-noise): a performed fictional creature call, used for companion creatures. Goats and hares use body movement sounds rather than inaccurate species calls.

- SketchMan3, [Wind Whoosh Loop](https://opengameart.org/content/wind-whoosh-loop): a processed wind loop with a 200 ms seam crossfade. This is an airflow texture, not a claimed field recording.

License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## Verification

The final production Chromium check fetched zero audio samples during startup, loaded all 15 optional recordings after a user gesture, produced the appropriate swimming contacts for the established account, stopped sampling and voices while hidden, and resumed with playable controls and no loading screen. The measured 8 Hz callback had a 0.255 ms p95 and 0.265 ms maximum in that desktop sample. A separate real AudioContext probe decoded the wind, retained one source through 80 flight/glide updates, fetched it once, and ended it on landing and mute. Its p95 was 0.105 ms, including planner and parameter updates. These are not installed iPhone PWA measurements or an in-world flight measurement. Surface selection, swimming, climbing, underwater source filtering, and discontinuity behavior are covered by behavioral tests. See [the movement verification report](../performance/2026-10-09-subtle-movement-and-hay.md).
