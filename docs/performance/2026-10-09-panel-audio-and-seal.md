# Create panel, embodied audio, and imported Seal pressure

Target: an established installed iPhone/iPad PWA account. The code changes are
verified locally; native keyboard appearance and the user's actual imported
account have not been measured on an iPhone. Browser plugin not available.
Browser checks used the cached Playwright CLI against a local production build
and an isolated established account, without clearing durable account storage.

## Imported versus native identity

Both identities reopen through the same locally verified active-session
metadata and saved owner-state path. Importing a Seal does not introduce a
server authentication gate for local gameplay. An imported account can contain
a much larger embedded archive, older creature histories, and cards received
from other owners. Those sizes and custody requirements can explain additional
local restoration work; the upload itself is not a reason to delay gameplay.

One remaining source of competition was `connectWildzProofSession`: after a
valid distribution challenge, it opened and parsed the complete encrypted
Identity Seal on the main thread to obtain a signing key. A large imported
archive made this unnecessary work more expensive than a small native account.
It now uses the existing signing worker, which returns only the small key
portion with `portableState: null`. The challenge, continuation signature,
optional Vault admission signature, passphrase handling, and distribution
request stay the same. This is optional background work after the world draw.
Worker-unavailable environments retain the existing scheduled local fallback.

The regression test supplies a real SDK identity and valid challenge, makes
main-thread IndexedDB access throw, and verifies the actual continuation
signature using the original identity. It failed against the previous reader
and passes with one worker request and zero main-thread archive reads. Offline
or malformed challenges continue to cause no archive read. This establishes
removal of a blocking operation, not a measured millisecond saving for the
user's Seal. The [earlier reopening report](2026-10-08-established-pwa-reopening.md)
contains separate archive and reopening measurements; those gains are not
counted again here.

No durable proof or owner state is cleared, no stored acceptance flag is
introduced, and local proof verification and custody fallback are preserved.

## Dark keyboard canvas and premium selectors

A late legacy rule overrode the early dark `html`/`body` background with a
light document background. The root now has a specific dark document class
and a dark color-scheme viewport declaration. The page canvas and native form
appearance both resolve dark without any keyboard observer or resize loop.
Native iOS accessory rendering still needs an installed-device check.
References: [WebKit dark mode](https://webkit.org/blog/8840/dark-mode-support-in-webkit/)
and [WKWebView under-page background](https://developer.apple.com/documentation/webkit/wkwebview/underpagebackgroundcolor).

The Create panel has a static emerald/gold finish, labeled selectors, distinct
material icons, clearer object rows, and generous tap targets. Existing draft,
allocation, worker selection, import/export, placement, and panel positioning
handlers are retained. The styling adds no backdrop blur, perpetual animation,
game-loop listener, proof read, or network request.

Production checks passed at 320 × 568, 375 × 667, 390 × 844, 844 × 390, and
1280 × 900 CSS pixels. Panels and all four popovers stayed inside each viewport;
selectors were at least 52.5 × 56 pixels. Typing, keyboard positioning,
minimizing/restoring with the same draft, and closing worked. A keyboard-sized
390 × 430 viewport retained the prompt. Computed `html` and `body` backgrounds
were both `rgb(9, 17, 13)` and the focused input was `rgb(8, 21, 14)`.

## Water, mountains, and measured interaction cost

The optional audio layer adds distance-triggered swimming strokes, sparse
submerged water texture, and steep-rock climbing contacts. Underwater listeners
omit land calls. Existing aquatic/body-depth projections supply the state;
there is no new terrain mesh or physics work. The fourteen mono samples total
56,469 encoded bytes, load sequentially after gesture unlock, and stay within
the existing four optional voices. See [audio provenance and behavior](../audio/embodied-sound.md).

The final production motion check at 390 × 844 verified a changed player
position and a changed camera view matrix. Camera observation recovered the
view matrix from `modelViewMatrix × inverse(modelMatrix)` because the active
shader optimized away its standalone `viewMatrix` uniform. Uniform reads were
outside the timed intervals; no renderer configuration was changed.

| Desktop production sample | Frames/ticks | p95 interval/cost | Maximum | Tasks/gaps over 50 ms |
| --- | ---: | ---: | ---: | ---: |
| Walking | 920 frames | 9.375 ms | 10.310 ms | 0 / 0 |
| Camera rotation | 388 frames | 9.390 ms | 10.245 ms | 0 / 0 |
| Optional 8 Hz audio callback | 38 ticks | 0.215 ms | 0.255 ms | not a frame measurement |

An earlier walking sample had a 8.815 ms p95 and 16.680 ms maximum; its camera
sample had a 9.010 ms p95 and 16.545 ms maximum. Host variance and different
locations mean these individual samples do not establish a frame-time speedup
or a regression. Neither had a task or gap over 50 ms. The final sample shows
no observed freeze during the exercised motion, not a guarantee of zero lag on
every device, account size, or scene.

The fourteen-asset audio check recorded zero startup audio requests, decoded
all optional assets after unlock, played actual ground contacts, and observed
at most three optional voices. Hiding stopped voices and sampling; returning
kept controls playable without a loading screen. The original 64-pixel logo
was preserved and the textless loading bar exposed actual readiness stages.
Reduced-motion rendering disabled the scan animation and fill transition.
Water/climbing source selection and discontinuities are covered by unit tests;
an in-world underwater or mountain device capture remains unperformed.

## Verification

- `pnpm test`: 3,607 passed, one skipped, zero failures.
- Strict lint passed. The final production build passed lint and type checks.
- `pnpm receiz:architecture-lock` passed; the secret scan passed.
- All fourteen asset SHA-256 hashes and digest filenames match; the existing
  twenty-five catalog entries are unchanged.
- `git diff --check` passed. Browser checks reported no JavaScript exceptions
  or framework error overlays. The isolated account still receives expected
  unauthenticated sync 401 responses without live server configuration.
- The build contains two existing vendor dynamic-require warnings from the
  SDK's `web-worker`/`ffjavascript` dependency. Circular chunk, missing hooks
  plugin, and missing snapshot-reference failures did not recur.

Compact browser measurements are saved in
[the companion JSON](2026-10-09-panel-audio-and-seal-measurements.json).
