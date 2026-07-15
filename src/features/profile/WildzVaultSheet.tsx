import type { PublicWildzCard } from "@/features/profile/public-profile";

export function WildzVaultSheet({ cards }: { cards: PublicWildzCard[] }) {
  return <div className="wildz-vault-sheet">
    <header><span>Public Vault</span><strong>{cards.length} verified</strong></header>
    {cards.length ? <div className="wildz-vault-grid">{cards.map((card) => <article key={card.id}>
      <i aria-hidden="true">✦</i><strong>{card.name}</strong><small>{card.status ?? "verified"}</small>
      <code>{card.proofDigest.slice(0, 18)}…</code>
      {card.listedPriceCents ? <b>${(card.listedPriceCents / 100).toFixed(2)}</b> : null}
    </article>)}</div> : <p className="wildz-sheet-empty">No companions are public yet.</p>}
  </div>;
}
