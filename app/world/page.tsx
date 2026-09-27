import Link from "next/link";
import { publicPageMetadata } from "@/lib/wildz/search-metadata";
import styles from "../v11-reader.module.css";

export const metadata = publicPageMetadata(
  "The Wildz World — A Place Worth Exploring",
  "Discover how Wildz makes an open-ended world, remembers each place, and lets distance shape the creatures you may meet.",
  "/world"
);

const WORLD_FACTS = [
  ["24 × 24", "The size of one region, in world units."],
  ["Any direction", "Region addresses can continue beyond the places already explored."],
  ["Nearby world", "Only the area around players needs to be active at once."]
] as const;

export default function WorldPage() {
  return <main className={styles.page}>
    <nav aria-label="Site navigation" className={styles.nav}><Link prefetch={false} href="/">Wildz</Link><Link aria-current="page" prefetch={false} href="/world">World</Link><Link prefetch={false} href="/creatures">Creatures</Link><Link prefetch={false} href="/conformance">Rarity & proof</Link><Link prefetch={false} href="/">Play</Link></nav>
    <header className={styles.hero}><span className={styles.eyebrow}>THE WORLD</span><h1>Go farther. Find somewhere new.</h1><p>Wildz has no designed edge to its map. Each place has an exact address, so the world can take shape around you as you travel and still be there when you return.</p><Link prefetch={false} href="/conformance">See how distance changes encounters →</Link></header>
    <section className={styles.section}><h2>One place, one address</h2><p className={styles.lede}>Think of an address as a region on the map and a precise spot inside it. A region is 24 world units wide and long. The spot inside it can be recorded to one millionth of a unit.</p><div className={styles.addressExample}><span>AN EXAMPLE PLACE</span><strong>Region −3, 42</strong><p>12 units across · 6 units in</p></div><p>Walking across a region border changes the region name while keeping your exact place. The same address recreates the same underlying terrain, even after you leave and come back.</p></section>
    <section className={styles.section}><h2>How big can the world be?</h2><p>The map is built from addresses rather than a fixed collection of tiles. There is no final region waiting at the edge. You can keep exploring in any direction, and distant places do not need to be held in memory while you are somewhere else.</p><div className={styles.featureGrid}>{WORLD_FACTS.map(([value, meaning]) => <article key={value}><strong>{value}</strong><p>{meaning}</p></article>)}</div><p>Real devices still have limits. Wildz keeps rendering and active simulation close to the player, and it limits the length of an address for safety. The world is open-ended; the number of places shown or stored at one time is deliberately bounded.</p><details className={styles.deepDive}><summary>See the exact address limits</summary><p>Region coordinates are signed whole numbers. A region coordinate may contain up to 4,096 decimal digits. Local coordinates are integers from 0 to 23,999,999 millionths of a world unit. These are safety and precision limits for a finite device, not a designed map border.</p></details></section>
    <section className={styles.section}><h2>Places shape discovery</h2><p>A region’s address determines its stable terrain and encounter sites. What happens there can add a separate history: a meeting, a journey, a structure, or a return with a companion. The place stays recognizable while its story grows.</p><div className={styles.callout}><strong>Distance changes the odds</strong><p>The farther an encounter site is from the starting area, the better its chance of a Rare, Mythic, or Eternal creature. Every eligible region still has a chance at every class. The exact odds are published for everyone to see.</p><Link prefetch={false} href="/conformance">Explore the rarity table →</Link></div></section>
    <section className={styles.section}><h2>Coming back matters</h2><p>If your companion’s first meeting place is known, returning together can become part of its story. The world can remember the encounter without changing that creature’s identity or rolling its rarity again.</p><p>Travel can take you unimaginably far, but the ground around you is always handled as a small local area. That is how exploration stays responsive as the address grows.</p><Link prefetch={false} href="/creatures">Meet the creatures who live here →</Link></section>
    <footer className={styles.footer}><Link prefetch={false} href="/">Wildz</Link><Link prefetch={false} href="/creatures">Creatures</Link><Link prefetch={false} href="/conformance">Rarity & proof</Link><Link prefetch={false} href="/about">About</Link><Link prefetch={false} href="/guide">Guide</Link></footer>
  </main>;
}
