# Wildz standalone feature parity

Source baseline: `kojibai/receiz-commerce` at `fb366506e218d82ecac20c60bc74c5977627713e`.

| Upstream capability | Result | Evidence / adaptation |
|---|---|---|
| Infinite 3D world, movement, camera, ecology | Preserved | `src/features/play`, browser keyboard and mobile drag evidence |
| Discovery, encounters, battles, capture | Preserved | Game-state and rendering-contract tests |
| Living cards, evolution, lineage, export/import | Preserved | Portable-card, living-card, and recovery tests |
| Missions, training, energy, progression | Preserved | Browser progression evidence and game-state tests |
| Atlas, landmarks, Rift travel | Preserved | Atlas, landmark, and Rift suites |
| Multiplayer presence, challenges, PvP, raids | Preserved | Multiplayer, PvP, and raid suites |
| Teams and Genesis League | Preserved | Team/league suite |
| Synthesized game audio and settings | Preserved | Audio lifecycle suite |
| Receiz identity | Adapted | Automatic first-landing ID plus Identity Seal restore |
| Explorer selection | Adapted | Versioned deterministic Kai Pulse character genesis |
| Vault recovery | Adapted | Verified PNG Vault import at genesis and in-game Vault |
| Public player profile and Vault | Added | Privacy-sanitized overlay and shareable dynamic route |
| Listing, trade, checkout | Adapted | Embedded overlay/API; settlement is fail-closed and credential-gated |
| Install/offline recovery | Added | Manifest, generated icons, safe service-worker cache |
| Storefront, admin, CMS, merchant dashboard | Intentionally removed | Outside the approved game-first product boundary |

All preserved game families remain covered by the extracted upstream test corpus. No commerce page or `/market` page is included.
