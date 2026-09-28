# Message notifications

The Messages inbox includes an **Enable notifications** button. Permission is
requested only when the player taps it. Once enabled, direct messages (including
room invitations and card offers) trigger Web Push even when Wildz is closed.
Lock-screen notifications show the sender, with message content kept inside the
app. Tapping a notification opens its conversation for the addressed player.

While the app is visible, the inbox refreshes every 15 seconds during gameplay
and every four seconds with Messages open. Push delivery also requests an
immediate refresh. Incoming messages display a dismissible alert and increment
the existing message-icon badge. Read receipts advance only while the selected
conversation is visible. Previously unread messages populate the badge on
startup without producing a burst of old alerts.

## Server setup

1. Run `pnpm exec web-push generate-vapid-keys` once. Set
   `WILDS_PUSH_VAPID_PUBLIC_KEY`, `WILDS_PUSH_VAPID_PRIVATE_KEY`, and
   `WILDS_PUSH_VAPID_SUBJECT` (a contact `mailto:` or HTTPS URL).
2. Provision an HTTPS Redis REST service and set `WILDS_PUSH_REDIS_URL` and
   `WILDS_PUSH_REDIS_TOKEN` on every application instance. This stores browser
   subscriptions, successful delivery IDs, and peer discovery hints; message
   authority remains in the existing Receiz conversation proofs.
3. Deploy the changes over HTTPS. Keep the VAPID pair stable between releases.
4. Enable notifications on one signed-in device, close the PWA, and send it a
   direct message from another player. Confirm the notification opens that
   conversation. Repeat with the app open to check the alert and unread badge.

Push delivery runs after the send response and does not block sending. Expired
subscriptions are removed on provider responses 404/410. Storage/provider
outages do not fail a message send; the foreground inbox remains available.
Browser and OS notification support and permission govern background delivery.
On iPhone/iPad, enable notifications from an installed Home Screen app.

## Capture presentation

Capture retains the original local presentation stages: emergence (1,050 ms),
ball capture (1,250 ms), and sealed finish (700 ms). The reward opens afterward.
The ball uses continuous frame-based rotation with smoothly settling speed,
bob, and scale; presentation does not await network publication.
