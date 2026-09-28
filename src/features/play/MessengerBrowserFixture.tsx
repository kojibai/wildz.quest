"use client";

import { WildsMessenger } from "./WildsMessenger";
import { useWildsMessenger } from "./use-wilds-messenger";

const peers = [
  { id: "fixture-aster", handle: "wildz_5711e8ec585b4e4b.receiz.id" },
  { id: "fixture-nova", handle: "wildz_109b751b49cb2b0c.receiz.id" },
  { id: "fixture-kai", handle: "wildz_40461fc85e47b8b7.receiz.id" }
];

export function MessengerBrowserFixture() {
  const messenger = useWildsMessenger({ guestId: "messenger-fixture", selfId: "fixture-self", selfHandle: "Explorer", livePeers: peers });
  return <main className="wildz-app">
    <button type="button" onClick={() => messenger.openMessenger()}>Open messages</button>
    <WildsMessenger messenger={messenger} selfId="fixture-self" roomChat={{ messages: [], onSend: async () => {} }} />
  </main>;
}
