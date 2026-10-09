# Subtle movement, aerial airflow, and hay gathering

Established account checks used the local production build in Chromium with a
390 × 844 viewport and the existing isolated verification account. Its durable
storage was retained. Browser plugin not available; checks used the cached
Playwright CLI. These measurements are desktop samples, not physical installed
iPhone/iPad PWA measurements.

## Changes and pressure limits

Walking and running contact gains are halved, with restrained variation and
smoothed actual speed. The two grass recordings also have a 2.2 kHz low-pass,
soft onset/release, and a peak 4 dB lower than before. Filtering happens during
asset preparation, with no runtime filter work. Old immutable assets remain
available for existing PWA clients; no proof store or cache is cleared.

Mountain foot contacts now read the admitted mountain skin through its existing
spatial index. The old lookup could return grass from beneath the physical
mountain. Creation floors retain precedence. Surface queries happen only for a
due contact, rather than in the movement or camera frame loop.

Flight/glide share one small wind recording, fading in/out and following actual
three-dimensional body speed. Gain and pitch update the same nodes at the
existing 8 Hz cadence. No additional timer, game-frame callback, startup fetch,
identity read, or server gate was added. The wind shares the existing four-voice
limit, so it cannot add an unlimited ambience layer. Active optional samples
total 84,777 bytes, including the 28,308-byte wind loop.

Hay already had lawful manual collection, but its marker used stone's companion
affordance and the work controls exposed only timber/stone. Create → Resources
now has Gather hay. It retains the conversation draft, minimizes the panel,
finds available hay in nine cached resource regions on the explicit action,
and marks a destination when out of reach. Gathering minimization keeps the
resource HUD and normal movement available; ordinary builder minimization
still enters its existing placement mode. Within 5.5 metres, the destination
offers Gather hay. Collection uses the existing signed local harvest operation,
capacity/replenishment, pending-command guard, and durable material lot. It adds
no continuous region scan, synthetic inventory increment, or new server call.

## Verification

The new behavior tests failed before their respective fixes: older walking gain,
missing airflow API, mountain grass classification, hay's Quarry requirement,
and selecting fiber instead of hay. The final suite passed 3,613 tests, with one
existing skip and no failures. Strict targeted lint, TypeScript, the production
build, the Receiz architecture lock, and secret scan passed. The build retains
the two existing SDK vendor dynamic-require warnings. All fifteen active asset
digests and filenames match their encoded bytes.

| Production desktop check | Count | p95 | Maximum | Gaps/tasks over 50 ms |
| --- | ---: | ---: | ---: | ---: |
| Character travel | 910 frames | 9.020 ms | 24.970 ms | 0 / 0 |
| Camera rotation | 380 frames | 9.040 ms | 16.115 ms | 0 / 0 |
| Optional audio callback | 38 ticks | 0.255 ms | 0.265 ms | — |

Travel changed the displayed coordinates; camera testing observed a changed
view matrix. The audio check fetched zero samples during startup, loaded all
fifteen after gesture unlock, produced real swimming contacts, remained within
four optional voices, stopped voices/sampling while hidden, and resumed with
playable controls and no loader. Its first attempted assertion expected land
steps, but the established account was swimming; the assertion was corrected
to accept the appropriate movement sound. JavaScript exceptions and framework
error overlays were absent. Unconfigured synthetic account sync continues to
produce the expected 401 responses without blocking gameplay.

Compared with the preceding desktop sample, the audio p95 changed from 0.215
to 0.255 ms; maximum changed from 0.255 to 0.265 ms. This small sampled difference
does not establish a regression or speedup. Neither motion sample observed a
freeze over 50 ms. This patch's purpose is surface correctness, quieter feedback,
and discoverable gathering while keeping additions off startup and frame loops.

Warm local CPU probes of 10,000 calls each measured a mountain contact p95 of
0.000375 ms, ordinary surface p95 of 0.001958 ms, and cached nine-region hay
lookup p95 of 0.003750 ms. Their maxima were 0.172417, 0.069792, and 0.130667 ms.
These are isolated warm lookups, not end-to-end interaction latency.

A separate browser AudioContext probe used the same runtime and planner code
with actual decoded audio. It fetched the wind once, held one looping source
through 80 flight/glide updates, and verified landing completion and mute.
Combined planner/parameter update p95 was 0.105 ms, maximum 0.435 ms. The isolated
account lacks a flight-capable active companion, so this is an audio integration
probe rather than an in-world flight control check.

The browser shortcut marked canonical hay at X 105, Z −242, retained the typed
shelter draft, and offered a 314 × 53.9 pixel resource button. Normal controls
moved the player to the source; gathering admitted exactly one hay lot. The
Satchel showed one hay after a full reload, with no JavaScript exceptions.
The shortcut initially reused builder placement minimization, which hid its
tracker. A browser regression check caught that, and gathering now suspends
placement while retaining the conversation. Ordinary minimization still places.

The Create panel and its selectors remained inside 320 × 568, 375 × 667,
390 × 844, 844 × 390, and 1280 × 900 viewports. Typing, minimize/restore,
keyboard-sized layout, dark canvas, and existing drafts continued to work.

## Audio matrix and reference ledger

| Event | Sample/mix | Scheduling and lifetime |
| --- | --- | --- |
| Ground walk/run | Surface-specific contacts, max gain 0.085 / 0.12 | Actual travelled distance; existing cadence |
| Grass | Two softened recordings, peak about −12 dBFS | Same encoded sizes, no runtime filtering |
| Mountain | Dry climbing contact | Admitted mountain index, only when due |
| Flight/glide | Shared wind, flight slightly fuller | One voice, 160 ms onset, 120 ms landing fade, 90 ms smoothing |
| Swimming/underwater | Existing quiet water textures | Same distance/cooldown and sparse underwater intervals |
| Nearby player/animal | Quieter spatial contacts and existing calls | At most 64 candidates, nearest eight, two sounds per tick |

- Loaded: threejs-gameplay-systems/SKILL.md and references/gameplay-workflows.md.
- Loaded: threejs-audio-generator/SKILL.md and references/audio-workflows.md.
- Loaded: React performance, frontend testing/debugging, systematic debugging,
  test-driven development, and verification-before-completion guidance.
- Physics selection: not required; movement, collision, and physics are unchanged.
- New-game checklist: not required; this is an established game update.
- Provider credential probe found no ElevenLabs key; existing CC0 source assets
  were processed locally. Provenance is in the catalog and
  [audio documentation](../audio/embodied-sound.md).

The [measurement JSON](2026-10-09-subtle-movement-and-hay-measurements.json)
records the browser checks and their scope.
