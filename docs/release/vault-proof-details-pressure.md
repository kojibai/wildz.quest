# Vault proof-details pressure contract

Written before implementation for the installed iPhone 17 / iOS 26.5.2 PWA
report involving a 68-card Vault. The working behavior baseline is
`8bc95c8a11a7825752bc5924e4df332a960a53cd`. This addendum covers only avoidable
proof presentation work and the Vault container's forced compositing hint.

## Source evidence

The selected card mounts both faces. Its back projects a dossier and immediately
places the complete canonical proof into a closed details element. The
Consciousness brain also projects the dossier without using its canonical proof
text. Dossier construction currently canonicalizes the complete card, parses
that string into a second complete object, and canonicalizes it again. These
allocations occur on opening Vault before proof text is requested. They are
present in the baseline as well as `d25a3af`; they do not establish the cause of
an iPhone process restart.

The Vault inventory's `translateZ(0)` and `will-change: transform` force a layer
for the whole tall inventory. Inspection shows no transform animation, pointer
calculation, or drag behavior on that container. The actual command sheet owns
dragging and scrolling, while the card's separate flipper owns the 3D turn.
Removing only that container hint preserves those interaction rules.

## Required behavior

- Constructing a dossier, a Consciousness brain, or a card back with closed
  proof details performs zero canonical proof-text serializations of an already
  admitted card for presentation.
- Opening proof details reveals the complete exact canonical card text,
  including every retained history event. Copying the proof obtains that same
  text even if the details were not opened first. No truncation, proof field,
  verification check, dossier section, or download action is removed.
- A dossier computes its proof text on first demand and reuses it for subsequent
  reads. The text equals the existing sorted-JSON encoding of the exact asset;
  producing it does not parse a second full-card copy.
- Changing the selected card while details are open displays that card's exact
  current proof. Closing details removes their large rendered text node.
- Remove only the inventory container's forced layer. Preserve the scroller,
  isolation, overscroll behavior, card transforms, flip transition, focus,
  selection, and native details interaction.
- Keep voice preparation, instant prepared exports, SDK sealing, worker
  lifetimes, wallet behavior, proof admission, complete history, and game state
  outside this change.

## Verification boundary

Behavioral tests execute the real dossier, brain, and card-back component,
instrument actual JSON work, open/close details, and call copy/download
handlers. Existing dossier, Consciousness, history, card flip, and pagination
tests remain required. A private test output directory avoids interference with
the coordinating agent's release build. The coordinating agent runs the full
release gate and visual browser checks.

Source and desktop tests can prove the avoided work and retained features.
They cannot establish actual iOS layer allocation, memory consumption, jetsam,
or a cure for the physical device's reload; those require the reported installed
iPhone context.

## Focused verification results

Before production edits, the five new behavioral tests compiled successfully
and reported four failures and one pass. Dossier plus Consciousness construction
encoded the complete admitted nine-event card four times and parsed it twice
without proof-text demand. Closed card-back details also retained its complete
text. The existing prepared Save handler passed before the change.

After the change, the same test observes zero complete-proof JSON encodings and
zero parses for dossier/brain summaries and closed card-back details. First
proof-text demand performs one encoding and no parse. Open, close, reopen,
selected-card replacement, full nine-event history, clipboard copying before
opening details, and the prepared Save handler all pass.

The private compiler and 63 focused tests passed with zero failures and no
skips. These include the new behavioral regression, existing dossier,
capability identity, full creature history, Consciousness, voice, card rail,
and Vault pagination suites. Targeted ESLint and `git diff --check` also passed.
The CSS diff removes only the inventory's forced `translateZ(0)` and
`will-change` declarations; actual native scrolling/card-turn behavior still
requires the coordinating agent's browser check and physical iPhone validation.
