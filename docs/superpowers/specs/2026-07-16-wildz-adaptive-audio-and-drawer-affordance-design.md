# Wildz Adaptive Audio and Drawer Affordance Design

## Status

Approved direction on 2026-07-16. This specification upgrades Wildz from procedural cue tones and a static oscillator drone to a real, commercially shippable adaptive soundtrack and complete action-sound system. It also corrects the mobile creature-drawer handle so it teaches its three sizes without words, clipping, extra permanent space, or D-pad overlap.

## Product outcome

Wildz should sound like a living place. Music must change coherently with the player's district, biome, weather, nearby world activity, encounter intensity, and progress. Major actions must feel tactile. The score must use real music recordings that can be bundled, modified, distributed, and used commercially without attribution, royalties, or future license payments.

The creature drawer keeps its existing compact visual language. Its closed state remains slim and completely visible, but no portion of the handle may occupy the D-pad's touch region. The handle silently explains that it can be dragged through three deliberate sizes.

## Governing constraints

- Only recordings explicitly dedicated under CC0 or a verified equivalent public-domain dedication may enter the shipped catalog.
- “Royalty free,” “free download,” public-domain composition, or permissive streaming access is not sufficient unless the specific recording has the required grant.
- No CC BY, noncommercial, no-derivatives, share-alike, proprietary stock, subscription, or revocable custom-license audio may ship under this design.
- Every admitted asset retains local evidence of title, creator, source URL, retrieval date, license URL or page evidence, checksum, original format, shipped derivatives, edits, duration, loudness, loop points, and assigned roles.
- Attribution may be preserved voluntarily in an internal manifest, but the player experience and commercial right to ship must not depend on displaying it.
- The Receiz Commerce `kai_turah_tone.mp3` is an existing product-owned signature sound. It is used as a protected semantic emblem, not as background music.
- Browser autoplay rules remain respected. Audio starts only after an eligible user gesture and must recover from suspend/resume, mute, tab visibility changes, and route teardown.

## Sonic identity

The score uses a sacred-futurist Wildz identity: memorable organic melody, crystalline harmony, live-feeling percussion, natural ambience, and restrained electronic motion. Curated CC0 recordings supply the musical performances. Wildz supplies a shared adaptive mix language so those recordings feel like one authored world rather than a playlist.

The shared language includes:

- compatible loudness, headroom, tonal balance, and transition lengths;
- a small set of recurring interval and timbre relationships derived from the Receiz signature tone without repeatedly replaying the full file;
- world ambience and location-specific texture layers that persist across track changes;
- stingers and transition cues that bridge different source recordings;
- intensity layers that enter and leave according to gameplay state;
- repetition protection and minimum-dwell rules.

No design can guarantee awards. The acceptance target is award-caliber craft: distinctive themes, emotionally coherent transitions, excellent tactile feedback, low repetition fatigue, clean browser playback, and an auditable right to ship every byte.

## World music map

### Exploration spine

General exploration receives a central Wildz theme built around expansive piano or plucked melody, crystalline synth color, organic percussion, and a strong but non-intrusive hook. It is the fallback when no more specific location or encounter owns the music state.

Biome, chapter, weather, time, and mastery do not necessarily replace the base recording. They first alter the persistent ambience, spectral color, secondary layer, and transition stinger. A track changes only when the next state is expected to persist long enough to justify it.

### Wayfinder Hollow districts

- **Trail Gate:** wind, hand percussion, plucked strings, and forward momentum. It should communicate departure, arrival, and regional possibility.
- **Dawn Commons:** warm ensemble, communal percussion, soft vocal texture, and playful life. Nearby-player and festival activity may add rhythmic density.
- **Mosslight Atelier:** glass, wood mallets, delicate mechanisms, resonant card energy, and the clearest instrumental relationship to the Receiz harmonic signature.
- **Cartographer House:** curious pizzicato, ticking detail, unfolding arpeggios, and navigational momentum.
- **Monument Walk:** spacious choir, restrained strings, bells, long decay, and emotional historical weight.

The player position is authoritative for the active district. A district transition uses hysteresis around boundaries and a minimum residency time so walking near an edge cannot cause rapid musical toggling.

### Encounters and world activity

- Creature search reduces harmonic density and raises spatial rustles, discovery details, and proximity cues.
- Capture, reveal, evolution, proof, sealing, lineage, and identity use short authored stingers with the Receiz signature reserved for proof-bearing or identity-bearing moments.
- Ecology events add compatible overlays or temporarily choose an event-specific theme. Resolution returns through a release stinger rather than an abrupt stop.
- Ordinary battle preserves the current location's harmonic identity where practical while introducing percussion, bass, ostinato, and tension layers.
- Boss encounters may use dedicated CC0 cinematic recordings with explicit phase transitions for telegraph, escalation, vulnerability, transformation, defeat, and aftermath.
- Low energy, mission completion, nearby landmarks, settlements, multiplayer arrivals, and weather use secondary mix parameters or stingers rather than constantly replacing the base track.

## Audio catalog and admission

The first sourcing lane is the OpenGameArt CC0 catalog and its curated CC0 fantasy collections. Candidate files must be individually auditioned; collection membership alone is not proof of quality or license. Every selected asset must pass both an artistic review and an admission check against its individual source page.

The initial catalog should cover:

- central exploration and at least one alternate exploration theme;
- five Wayfinder Hollow district identities;
- calm forest, weather, water, night, settlement, and interior ambience;
- normal battle, high-intensity battle, and boss phases;
- discovery, capture, victory, defeat, proof, seal, evolution, landmark, route, ecology, and social stingers;
- footsteps by terrain, foliage, water, creature movement, impacts, abilities, UI, cards, drawer snaps, navigation, rewards, errors, and environmental interactions.

Assets are stored under `public/audio/wildz/` by role, with originals or archival evidence kept separately from browser-ready derivatives when repository-size policy permits. Browser delivery favors compact, broadly supported formats. Seamless loops are trimmed at zero crossings, checked for encoder padding, and auditioned through multiple consecutive repetitions. Streaming tracks are prefetched selectively rather than downloading the entire catalog at first paint.

## Adaptive audio architecture

### State projection

A pure projector converts current game state into a compact `WildsAudioScene` containing:

- location: world, settlement, district, biome, chapter, landmark proximity;
- environment: weather, time or lighting phase, ecology activity;
- gameplay: exploration, search, capture, battle, boss phase, victory, failure;
- intensity: normalized calm-to-critical value;
- identity events: proof, seal, reveal, evolution, lineage;
- mix constraints: player settings, reduced-data preference, page visibility, and audio readiness.

The projector owns no playback. It is deterministic and unit-testable.

### Director

An adaptive director compares the previous and next scenes and chooses a transition intent. It applies priority, hysteresis, residency, cooldown, and repetition rules. Priority is:

1. critical identity or proof stinger;
2. boss phase;
3. battle or capture sequence;
4. time-bounded ecology event;
5. district or landmark;
6. biome and weather variation;
7. general exploration.

Higher-priority states may duck or suspend lower layers but retain enough ambience to preserve place. When the higher state exits, the director restores the most current world scene rather than a stale pre-encounter snapshot.

### Runtime and buses

The browser runtime uses Web Audio with independently controlled buses:

- master;
- music;
- ambience;
- effects;
- UI;
- signature and stingers.

Each bus has gain smoothing. Music crossfades avoid clicks and use metadata-defined safe transition regions when available. Important effects briefly duck music through a gentle envelope. Concurrent voices are bounded by category with deterministic replacement rules. Repeated footsteps and common effects use small variation pools with pitch and gain variation inside authored limits.

The current oscillator cue bank remains only as a temporary fallback for an asset that fails to decode; it is not the premium path. A failed optional layer must degrade silently without taking down gameplay. A failed required base track falls back to the nearest admitted exploration track and records a diagnostic in development.

### Unlock, lifecycle, and offline behavior

- The first eligible pointer or keyboard gesture unlocks the context.
- Explicit sound controls remain usable before unlock and describe readiness accessibly.
- Pause, visibility change, navigation, and teardown stop or suspend scheduled work without leaking nodes or timers.
- Settings changes apply smoothly to active buses.
- The service worker caches a bounded core score and SFX set for offline play. Optional alternates may populate opportunistically.
- The game never waits on decorative audio before becoming playable.

## Receiz signature usage

The 9.04-second mono `kai_turah_tone.mp3` is copied into the Wildz audio catalog with provenance connecting it to the Receiz Commerce source. Its full form is reserved for rare, consequential moments. Short derivatives or harmonically related stingers may support:

- verified identity continuity;
- proof sealing;
- canonical reveal;
- exceptional evolution or lineage;
- high-value settlement confirmation.

Routine button presses, ordinary chat, footsteps, and ambient loops do not use the full signature. This protects recognition and avoids fatigue.

## Action sound matrix

Every meaningful player action receives feedback appropriate to its weight:

- movement: terrain-aware steps, run cadence, water, foliage, landing, stop;
- exploration: scan, proximity warmth, rustle, emergence, landmark approach;
- creatures: idle, notice, move, attack, hit, ability, capture, reveal, evolve;
- combat: telegraph, attack families, shield, damage, critical, vulnerable, phase change, victory, defeat;
- world: weather, doors, routes, settlement arrival, services, ecology states, portals, resources;
- collection and commerce: card lift, select, place, confirm, rejection, admitted settlement;
- UI: focus-grade taps, navigation, drawer snaps, toggles, success, warning, error;
- multiplayer: player arrival, challenge, response, social event.

The matrix distinguishes UI feedback from world sound and never allows a cosmetic cue to imply an unverified ownership or settlement result.

## Three-state creature drawer

### Layout contract

The drawer has three snap states:

- **Closed:** a slim, fully visible handle with no content panel height.
- **Preview:** a useful view of the active creature and immediate collection choices.
- **Expanded:** the full collection surface with internal scrolling.

The closed handle occupies a reserved strip above the D-pad. Its visible and interactive bounds never overlap the D-pad's hit target. It is not clipped by the deck, viewport, or safe area. The reserved strip comes from repositioning within the existing composition, not from increasing the permanent bottom-deck footprint.

### Wordless affordances

Four cues share the existing handle footprint and each communicates one meaning:

- a thin active-creature color edge says content exists behind the handle;
- a brief upward light sweep says the handle can be dragged;
- three small illuminated stops show the available sizes and current state;
- a chevron shows the next expansion or collapse direction.

The light sweep runs on first relevant discovery and may repeat only after long inactivity. It never pulses continuously. The active-creature edge remains subtle. The active stop changes continuously during drag and settles decisively at snap completion. The chevron reverses at the expanded boundary.

### Gesture model

- Dragging follows the pointer directly within bounded limits.
- Releasing chooses the nearest state, biased by meaningful release velocity.
- Tapping advances to the next useful state; at expanded, tapping collapses toward preview.
- A restrained haptic response fires at each supported snap where the platform permits it.
- Pointer capture prevents accidental loss during drag; cancellation returns safely to the nearest state.
- Keyboard and assistive controls expose the same three state changes with an accessible name, value, and expanded relationship.
- Reduced-motion mode removes the light sweep and spring animation but preserves state indicators and direct manipulation.

## Performance and quality

- Initial audio metadata and the minimal core set remain bounded; district alternates load just in time.
- Decoded-buffer memory is capped with least-recently-used eviction for optional tracks and effects.
- Audio transitions and UI dragging must not trigger React render storms or Three.js frame drops.
- The drawer interaction stays responsive at 60 Hz where the device allows and uses transform-driven motion.
- Mobile Safari is a first-class target for audio unlock, format support, safe areas, and touch gestures.
- Audio mastering targets consistent perceived loudness with headroom for effects and stingers; clipping is a release failure.

## Error handling and diagnostics

- License or provenance uncertainty rejects an asset before it reaches the shipped manifest.
- Decode or network failure falls back by role and does not interrupt gameplay.
- Missing optional ambience removes only that layer.
- Missing signature audio disables the signature event and reports a development diagnostic rather than substituting a misleading tone.
- Development diagnostics expose current scene, chosen track, active buses, transition reason, cache state, and rejected/failed assets.
- Production logging contains no secret URLs or user identity data.

## Test strategy

Implementation follows test-first development.

Automated tests verify:

- audio-scene projection from district, biome, weather, encounter, boss, ecology, and identity states;
- priority, hysteresis, residency, cooldown, and repetition behavior;
- bus gain calculations, mute, smooth settings changes, ducking, voice limits, fallback, teardown, and resume;
- manifest admission rejects missing or non-CC0 license evidence;
- every shipped audio file appears in the admitted manifest and every manifest checksum matches;
- the Receiz signature is mapped only to approved semantic events;
- closed, preview, and expanded drawer state projection;
- pointer distance and velocity snapping;
- handle and D-pad interactive rectangles never intersect at supported mobile viewports;
- reduced-motion and keyboard behavior;
- the closed handle remains fully inside the viewport and deck composition.

Browser QA covers:

- first-gesture unlock and sound settings;
- exploration-to-district transitions across all five districts;
- weather, search, capture, battle, boss, victory, and restoration to the current location;
- offline reload with the core soundtrack and action set;
- repeated loop and crossfade audition for clicks, gaps, clipping, and unwanted silence;
- drawer tap, slow drag, fast flick, cancellation, all three snap stops, internal scrolling, and D-pad movement at 360 × 640, 390 × 844, and 430 × 932;
- console errors, audio-node leaks, long-session repetition, and representative mobile performance.

## Release gates

The work is complete only when:

- all shipped music and effects have verified CC0/public-domain recording evidence and matching checksums;
- the catalog contains real music for general exploration, all five districts, ordinary battle, and boss play;
- meaningful gameplay actions have an audited effect or intentional silence decision;
- the Receiz signature is present and semantically protected;
- district and encounter transitions are musically coherent and free of clicks or obvious gaps;
- mute, volume groups, unlock, pause/resume, offline behavior, and teardown work on supported browsers;
- the drawer visibly teaches hidden content, drag direction, three sizes, and next direction without words;
- the closed drawer is slim, fully visible, unclipped, and does not overlap the D-pad visually or interactively;
- automated tests, type checking, production build, mobile browser interaction, audio audition, and responsive visual QA pass;
- remaining catalog, mix, performance, or browser limitations are reported rather than described as complete.
