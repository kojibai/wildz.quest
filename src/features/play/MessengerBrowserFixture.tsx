"use client";

import { WildsMessenger } from "./WildsMessenger";
import { useWildsMessenger } from "./use-wilds-messenger";
import { useState } from "react";
import Link from "next/link";

const peers = [
  { id: "fixture-aster", handle: "wildz_5711e8ec585b4e4b.receiz.id" },
  { id: "fixture-nova", handle: "wildz_109b751b49cb2b0c.receiz.id" },
  { id: "fixture-kai", handle: "wildz_40461fc85e47b8b7.receiz.id" }
];

export function MessengerBrowserFixture() {
  const [walletPeer, setWalletPeer] = useState<string | null>(null);
  const messenger = useWildsMessenger({ guestId: "messenger-fixture", selfId: "fixture-self", selfHandle: "Explorer", livePeers: peers });
  return <main className="wildz-app">
    <p>Chat layout test · test explorers · wallet transfers run from the game</p>
    <button type="button" onClick={() => messenger.openMessenger()}>Open messages</button>
    {walletPeer ? <p role="status">Wallet button selected for {walletPeer}. <Link href="/">Return to the game to open your wallet.</Link></p> : null}
    <WildsMessenger messenger={messenger} selfId="fixture-self" roomChat={{ messages: [], onSend: async () => {} }} onSendPhi={peer => { messenger.closeMessenger(); setWalletPeer(peer.handle); }} resourceExchange={<p>Food and resources for this explorer</p>} />
  </main>;
}
