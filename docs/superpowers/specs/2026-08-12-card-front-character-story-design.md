# Card Front Character Story Design

## Goal

Make each saved character feel alive on the front of its collectible card without reducing the card's readability or changing its overall proportions.

## Approved Layout

The existing lower ability area will keep its current height and become a two-column, equal-width layout:

- The left half contains the character's two existing power panels, stacked vertically.
- The right half contains one story panel headed `Their Story`.
- The story panel shows a compelling three-to-four-line excerpt on a full-size card.
- Compact gallery cards use a shorter clamp so text cannot overflow or distort the card.
- The complete character story remains available on the card back.

The existing stats, artwork, rarity, footer, proof digest, and card flip behavior remain unchanged.

## Character Story

The front excerpt is deterministic and belongs to the exact saved card. It is derived from the same sealed character inputs already used by the living-card dossier, including the character's name, habitat, temperament, signature gesture, birth context, lineage where applicable, and living history.

Story generation will be exposed through a focused shared projection so the card front and card back do not develop separate or contradictory biographies. It will not mutate the saved card, alter proof bytes, or introduce editable or unverified story state.

The excerpt should lead with character rather than technical proof language. It should communicate who the companion is and how it behaves, while the longer dossier story can retain additional origin and history detail.

## Components and Data Flow

1. The existing dossier story projection remains the source of truth for character biography.
2. A reusable story projection provides the card front with character-specific copy without requiring UI state or network access.
3. `WildsCard` renders one lower information grid containing the existing ability list and the new story panel.
4. CSS gives the ability list and story panel equal columns, preserves the current lower-region height, clamps text by card size, and prevents overflow.

Unknown legacy forms continue to follow the card's current null-render behavior. A verified card with limited historical detail still receives deterministic copy from its catalog form, captured moment, and sealed visual identity.

## Responsive and Accessibility Behavior

- Full-size cards use an equal 50/50 split.
- Compact cards retain the split and reduce the visible story line count rather than shrinking text below the existing readable scale.
- Story text is real semantic text, not baked into artwork.
- The story panel heading identifies the content without adding an interactive control.
- The card's existing accessible label remains valid, and no new focus target is introduced.

## Verification

- Add a focused render contract confirming the front card renders `Their Story` alongside the ability region.
- Add a story projection test proving that different sealed character inputs produce character-specific text and that the same card produces stable text.
- Run the relevant card/dossier tests and project type checking.
- Verify full-size and compact card renderings for balanced columns, readable copy, and no overflow.

## Out of Scope

- Editing a character's biography.
- Adding new saved data or changing portable-card proof schemas.
- Changing the complete dossier on the card back.
- Adding a story toggle, carousel, or other front-card interaction.
