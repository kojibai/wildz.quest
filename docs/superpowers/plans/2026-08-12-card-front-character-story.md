# Card Front Character Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the collectible card's lower region evenly between its two powers and a compelling, readable story excerpt unique to the saved character.

**Architecture:** Add one shared deterministic story projection beside the existing living-card dossier so the front excerpt and full back story use the same sealed inputs. Render the projection in `WildsCard` inside a new two-column lower grid, with CSS line clamping for full-size and compact cards and no new persisted state.

**Tech Stack:** TypeScript, React 19, Next.js 15, CSS, Node test runner, React DOM server rendering

## Global Constraints

- Keep the existing card dimensions, artwork, stats, rarity, footer, proof digest, and flip behavior unchanged.
- Use an equal 50/50 lower split: two stacked power panels on the left and one `Their Story` panel on the right.
- Show a compelling three-to-four-line excerpt at full size and a shorter clamp in compact gallery cards.
- Derive story copy deterministically from sealed character data; do not add mutable story fields or alter proof bytes.
- Keep the complete character story on the card back.
- Add no front-card interaction or new focus target.

---

### Task 1: Shared Character Story Projection

**Files:**
- Modify: `src/features/play/living-card-dossier.ts`
- Test: `tests/wildz-card-front-story.test.ts`

**Interfaces:**
- Consumes: `PortableCardAsset`, `creatureForm`, `deriveBirthGenome`, `currentLivingGenome`, `identityForGenome`, and existing living-card type guards.
- Produces: `projectLivingCardStory(asset: PortableCardAsset): { full: string; excerpt: string }`.

- [ ] **Step 1: Write the failing story projection test**

Create `tests/wildz-card-front-story.test.ts` with two sealed cards and assert the public projection is stable, character-specific, shorter on the front, and grounded in the character's name and habitat:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { creatureForm } from "../src/features/play/creature-catalog";
import * as dossierModule from "../src/features/play/living-card-dossier";
import { sealCollectedCard } from "../src/features/play/portable-card";

test("saved cards project stable character-specific front stories", () => {
  const projectLivingCardStory = (dossierModule as unknown as {
    projectLivingCardStory?: (asset: ReturnType<typeof sealCollectedCard>) => { full: string; excerpt: string };
  }).projectLivingCardStory;
  assert.equal(typeof projectLivingCardStory, "function");

  const mintcub = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "receiz:story", encounterId: "encounter:story:mint", capturedAt: "2026-08-12T12:00:00.000Z", generatorVersion: 2 });
  const volt = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "receiz:story", encounterId: "encounter:story:volt", capturedAt: "2026-08-12T13:00:00.000Z", generatorVersion: 2 });

  const first = projectLivingCardStory?.(mintcub);
  assert.deepEqual(projectLivingCardStory?.(mintcub), first);
  assert.notEqual(projectLivingCardStory?.(volt).excerpt, first?.excerpt);
  assert.match(first?.excerpt ?? "", new RegExp(mintcub.manifest.name));
  assert.match(first?.excerpt ?? "", new RegExp(creatureForm(mintcub.manifest.formId)?.habitat ?? "missing habitat", "i"));
  assert.ok((first?.excerpt.length ?? Infinity) < (first?.full.length ?? 0));
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wildz-card-front-story.test.js`

Expected: FAIL because `projectLivingCardStory` is not exported.

- [ ] **Step 3: Implement the minimal shared projection**

In `living-card-dossier.ts`, replace the private full-story-only helper with an exported projection:

```ts
export type LivingCardStory = Readonly<{ full: string; excerpt: string }>;

function storyCopy(asset: PortableCardAsset, temperament: string, gesture: string, habitat: string): LivingCardStory {
  const character = temperament.toLowerCase();
  const signal = title(gesture).toLowerCase();
  if (isLivingCardAsset(asset) && asset.manifest.birth.kind === "fusion") {
    const parents = asset.manifest.lineage.parentAssetIds ?? [];
    return {
      excerpt: `${asset.manifest.name} carries two living lineages into the ${habitat} with a ${character} heart. Its ${signal} is a promise that every bond will become a story only this companion can tell.`,
      full: `${asset.manifest.name} was born where two living lineages met beneath the ${habitat} Kai Pulse. Traits from both parents—${parents.join(" and ")}—became a new independent companion with a ${character} heart. Watch for the ${title(gesture)}: it is how this one-of-one character chooses to say, “I am here with you.”`
    };
  }
  const moment = new Date(asset.manifest.capturedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return {
    excerpt: `${asset.manifest.name} is a ${character} spirit of the ${habitat}, known by its ${signal}. Since answering your signal, every journey and bond has become part of the one living story only this companion can carry.`,
    full: `${asset.manifest.name} first answered your signal in the ${habitat} on ${moment}. Its ${character} nature comes through in every ${signal}, and each earned battle, journey, and bond moment now extends the same living history instead of replacing the companion you met.`
  };
}

export function projectLivingCardStory(asset: PortableCardAsset): LivingCardStory {
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("wilds_dossier_form_unknown");
  const genome = isLivingCardAsset(asset)
    ? currentLivingGenome(asset)
    : deriveBirthGenome({ formId: asset.manifest.formId, proofDigest: asset.proof.digest, variant: asset.manifest.variant.traits });
  const identity = identityForGenome(genome, asset.proof.digest);
  return storyCopy(asset, genome.face.expressionSet, identity.behavior.gesture, form.habitat);
}
```

Use `storyCopy(asset, temperament, gesture, form.habitat).full` in `projectLivingCardDossier` so it keeps reusing the already-derived identity rather than recomputing it.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run: `pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wildz-card-front-story.test.js`

Expected: PASS with one test and zero failures.

- [ ] **Step 5: Run existing dossier regression tests**

Run: `node --test .test-build/tests/wildz-kai-card-dossier.test.js .test-build/tests/wildz-creature-history.test.js`

Expected: PASS with zero failures.

- [ ] **Step 6: Commit the projection**

```bash
git add src/features/play/living-card-dossier.ts tests/wildz-card-front-story.test.ts
git commit -m "feat: project unique card front stories"
```

### Task 2: Card Front Powers and Story Split

**Files:**
- Modify: `src/features/play/WildsCard.tsx`
- Modify: `app/globals.css`
- Test: `tests/wildz-card-front-story.test.ts`

**Interfaces:**
- Consumes: `projectLivingCardStory(asset).excerpt` from Task 1.
- Produces: semantic `.wilds-card-lower`, `.wilds-card-abilities`, and `.wilds-card-story` markup with the visible heading `Their Story`.

- [ ] **Step 1: Write the failing rendered-card test**

Append a real server-render test to `tests/wildz-card-front-story.test.ts`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsCard } from "../src/features/play/WildsCard";

test("card front gives powers and character story equal lower regions", () => {
  const asset = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "receiz:story", encounterId: "encounter:story:render", capturedAt: "2026-08-12T14:00:00.000Z", generatorVersion: 2 });
  const html = renderToStaticMarkup(createElement(WildsCard, { asset }));
  const story = dossierModule.projectLivingCardStory?.(asset);

  assert.match(html, /class="wilds-card-lower"/);
  assert.match(html, /class="wilds-card-abilities"/);
  assert.match(html, /class="wilds-card-story"/);
  assert.match(html, />Their Story</);
  assert.ok(story && html.includes(story.excerpt));
  for (const ability of asset.manifest.abilityNames) assert.ok(html.includes(ability));
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wildz-card-front-story.test.js`

Expected: FAIL because the card does not render `.wilds-card-lower`, `.wilds-card-story`, or `Their Story`.

- [ ] **Step 3: Implement the card markup**

In `WildsCard.tsx`:

- Import `projectLivingCardStory`.
- Memoize `projectLivingCardStory(asset).excerpt`.
- Wrap the existing abilities in `<div className="wilds-card-lower">`.
- Keep both existing ability panels inside `.wilds-card-abilities`.
- Add `<aside className="wilds-card-story"><strong>Their Story</strong><p>{story}</p></aside>` as its sibling.

- [ ] **Step 4: Implement the balanced responsive styles**

Replace the ability-only lower styles in `app/globals.css` with:

```css
.wilds-card-lower { display: grid; min-height: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.wilds-card-abilities { display: grid; min-width: 0; min-height: 0; grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 6px; }
.wilds-card-abilities > div { display: grid; min-width: 0; align-content: start; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 6px; padding: 7px 8px; background: rgb(3 16 23 / 58%); border: 1px solid rgb(255 255 255 / 9%); border-radius: 9px; }
.wilds-card-abilities strong { min-width: 0; overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.wilds-card-abilities b { color: var(--card-accent); font-size: 10px; }
.wilds-card-abilities p { display: -webkit-box; grid-column: 1 / -1; margin: 0; overflow: hidden; color: #9ab4be; font-size: 7px; line-height: 1.25; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.wilds-card-story { display: grid; min-width: 0; min-height: 0; align-content: start; gap: 4px; padding: 8px 9px; overflow: hidden; background: linear-gradient(145deg, color-mix(in srgb, var(--card-primary) 13%, rgb(3 16 23 / 72%)), rgb(3 16 23 / 72%)); border: 1px solid color-mix(in srgb, var(--card-accent) 25%, transparent); border-radius: 9px; }
.wilds-card-story strong { color: var(--card-accent); font-size: 8px; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
.wilds-card-story p { display: -webkit-box; margin: 0; overflow: hidden; color: #c4d8de; font-size: 8px; line-height: 1.32; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }
.wilds-collectible-card.compact .wilds-card-story p { -webkit-line-clamp: 3; }
```

Preserve the existing `.wildz-profile-card-local` responsive font overrides and extend them only if browser verification shows compact overflow.

- [ ] **Step 5: Run the focused test to verify GREEN**

Run: `pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wildz-card-front-story.test.js`

Expected: PASS with two tests and zero failures.

- [ ] **Step 6: Run card and render regressions**

Run: `node --test .test-build/tests/wildz-kai-card-dossier.test.js .test-build/tests/wilds-render-contract.test.js .test-build/tests/wildz-profile-vault-gallery.test.js .test-build/tests/wildz-mobile-performance.test.js`

Expected: PASS with zero failures.

- [ ] **Step 7: Commit the UI**

```bash
git add src/features/play/WildsCard.tsx app/globals.css tests/wildz-card-front-story.test.ts
git commit -m "feat: split card powers and character story"
```

### Task 3: Visual and Full Verification

**Files:**
- Modify only if verification reveals a scoped issue: `src/features/play/WildsCard.tsx`, `src/features/play/living-card-dossier.ts`, `app/globals.css`, `tests/wildz-card-front-story.test.ts`

**Interfaces:**
- Consumes: completed story projection and card-front layout from Tasks 1 and 2.
- Produces: verified full-size and compact card presentation with no overflow or regressions.

- [ ] **Step 1: Run type checking and lint**

Run: `pnpm typecheck`

Expected: exit 0 with no TypeScript errors.

Run: `pnpm lint`

Expected: exit 0 with no ESLint errors.

- [ ] **Step 2: Run the complete test suite**

Run: `pnpm test`

Expected: exit 0 with zero failed tests.

- [ ] **Step 3: Verify full-size and compact cards in the browser**

Start the existing development server with `pnpm dev`, open a saved-card surface and the profile vault gallery using the browser tooling, and capture full-size and compact screenshots.

Confirm visually:

- lower region remains the same overall size;
- abilities occupy the left half and story occupies the right half;
- both powers remain identifiable;
- `Their Story` and the excerpt are readable;
- no text or panel crosses the card border;
- compact gallery cards keep the same structure with a shorter excerpt;
- flipping still reveals the complete story on the back.

- [ ] **Step 4: Inspect the final diff and re-run affected checks after any visual adjustment**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only intended files changed.

If visual verification required a CSS adjustment, rerun the focused card story test, `pnpm typecheck`, and `pnpm lint` before proceeding.

- [ ] **Step 5: Commit verification-driven adjustments, if any**

```bash
git add src/features/play/WildsCard.tsx src/features/play/living-card-dossier.ts app/globals.css tests/wildz-card-front-story.test.ts
git commit -m "fix: polish card story readability"
```

Skip this commit when verification required no further source changes.
