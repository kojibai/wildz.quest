import Link from "next/link";

export default function OfflinePage() {
  return (
    <main>
      <p>Connection unavailable</p>
      <h1>The live Wildz trail is offline.</h1>
      <p>
        Previously visited public profiles, public cards, and cached card details remain readable on this device.
      </p>
      <p>
        Sign-in, the live world, social presence, market activity, publishing, listing, trade, transfer, and payment
        actions require a connection.
      </p>
      <p>Reconnect before continuing live play or making changes.</p>
      <Link href="/">Return to Wildz</Link>
    </main>
  );
}
