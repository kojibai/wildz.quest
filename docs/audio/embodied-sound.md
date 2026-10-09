# Embodied movement audio

The existing music, ambience, proof signature, and action cues stay intact. Optional mono MP3 recordings add surface footsteps, animal movement, nearby creature calls, and movement from visible real players. The player's actual travelled distance triggers steps; camera orientation and three-dimensional distance determine stereo direction and attenuation. Stationary actors do not generate walking loops.

The planner samples at 8 Hz after the world is playable and audio has been unlocked, checks at most 64 visible sources, and retains the nearest eight. There are at most four additional decoded voices. Small samples load sequentially through the existing background scheduler. Missing/offline samples are skipped without waiting or synthesizing fallback noise. Already loaded recordings stay in the existing audio service-worker cache. Muting, hiding the document, opening an exclusive panel, and disposal stop optional voices; resume resets movement history so there is no catch-up burst. None of this reads proof history or requests identity authority.

A single 12 ms landing haptic uses the existing capability-checked vibration helper, is suppressed with reduced motion, and is not repeated for footsteps. Safari on iPhone/iPad does not expose arbitrary navigator.vibrate patterns; those devices retain audio/visual feedback without hidden-control haptic workarounds.

## Recordings and licenses

All new assets are CC0, trimmed, faded at their boundaries, converted to mono 22.05 kHz MP3 at 40 kbit/s, and stored under immutable content-digest filenames. Exact SHA-256 values and provenance are in public/audio/wildz/catalog.json. Total encoded bytes: 44,279.

- TinyWorlds, [Different steps on wood, stone, leaves, gravel and mud](https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud): grass/leaves, soil, gravel trail, stone, and timber steps. Original field recordings from pdsounds.org, edited for Minetest.
- ezwa, submitted by qubodup, [6 short water splashes](https://opengameart.org/content/6-short-water-splashes): wading steps.
- syncopika, [Bird chirping sounds](https://opengameart.org/content/bird-chirping-sounds): a short backyard bird recording.
- mikeask, [Some animal noise](https://opengameart.org/content/some-animal-noise): a performed fictional creature call, used for companion creatures. Goats and hares use body movement sounds rather than inaccurate species calls.

License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
