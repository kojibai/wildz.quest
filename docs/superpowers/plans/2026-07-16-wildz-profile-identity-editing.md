# Wildz Profile Identity Editing Implementation Plan

**Goal:** Move username and profile-image editing into the owner profile while preserving the automatic Receiz ID key, globally admitting username changes through Receiz v106 continuity, and keeping local play continuity instant.

**Architecture:** Genesis always uses the automatically created or restored Receiz identity. Profile editing signs the existing key's requested identity continuation, sends it through the same-origin session route to the canonical Receiz continuation rail, accepts only a canonical connected response for that key, and atomically rebinds local owner state through the existing continuity alignment transaction. Public profile projection and a bounded image reference are updated only after the identity append succeeds.

**Tech Stack:** Next.js App Router, React, IndexedDB continuity repository, `@receiz/sdk@106.0.0`, Node test runner.

### Task 1: Lock the entry and profile contracts with failing tests

**Files:**
- Modify: `tests/wildz-genesis-copy.test.ts`
- Modify: `tests/wildz-profile.test.ts`
- Modify: `tests/wildz-profile-route.test.ts`
- Create: `tests/wildz-profile-identity-editing.test.ts`

Assert that Genesis contains no username form, the owner profile owns edit/save controls, profile images sanitize safely, and the identity rename path requires canonical Receiz admission before local continuity changes.

### Task 2: Add a canonical v106 profile-identity adapter

**Files:**
- Modify: `src/lib/receiz/wildz-identity-adapter.ts`
- Modify: `app/api/auth/wildz/session/route.ts`
- Test: `tests/wildz-canonical-session-alignment.test.ts`
- Test: `tests/wildz-profile-identity-editing.test.ts`

Create a proof-signed username claim operation from the existing key. Treat Receiz continuation as the atomic authority, distinguish conflict from transport failure, require the returned session to match the key and requested canonical actor, then call the existing atomic owner-scope alignment transaction.

### Task 3: Make Genesis automatic

**Files:**
- Modify: `src/features/identity/WildzGenesis.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Test: `tests/wildz-genesis-copy.test.ts`

Remove entry-page username state, validation, and identity replacement. Enable explorer selection immediately for the automatic or restored identity.

### Task 4: Add tasteful owner-only profile editing

**Files:**
- Modify: `src/features/profile/public-profile.ts`
- Modify: `src/features/profile/WildzProfileSheet.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `app/globals.css`
- Test: `tests/wildz-profile.test.ts`
- Test: `tests/wildz-profile-route.test.ts`

Add an icon-only edit control, compact username/display-name editor, image picker with immediate preview, explicit checking/saving states, pressed animation, accessible status, and no edit affordance on other users' profiles. Keep existing profile visual language and dimensions.

### Task 5: Persist and publish the admitted presentation

**Files:**
- Modify: `src/features/profile/public-profile.ts`
- Modify: `src/lib/receiz/wildz-profile-adapter.ts`
- Modify: `src/features/shell/WildzApp.tsx`
- Test: `tests/wildz-public-profile-adapter.test.ts`

Carry the bounded profile image in the public profile projection. After Receiz admits the username, reset publication identity, republish from the canonical owner, and leave all historical card ownership untouched.

### Task 6: Verify and publish

Run focused tests first, then lint, sequential typecheck, full tests, Receiz release/conformance checks, and production build. Commit the v106 alignment and profile slice to `main`, then push `main`.
