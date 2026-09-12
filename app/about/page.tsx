import Link from "next/link";
import { publicPageMetadata } from "@/lib/wildz/search-metadata";
import styles from "../guide/reader.module.css";
export const metadata = publicPageMetadata("About Wildz — Free Browser Creature Adventure", "Discover Wildz, an open-source browser game about living creature companions, exploration, and building. Official game information and source code.", "/about");
export default function AboutPage() {
  return <main className={styles.page}>
    <nav aria-label="Site navigation"><Link prefetch={false} href="/">Wildz</Link><Link prefetch={false} href="/guide">How to play</Link><Link prefetch={false} href="/laws">World law</Link></nav>
    <header><p className={styles.eyebrow}>THE OFFICIAL WILDZ GAME</p><h1>Companions.<br />Discovery. A place to belong.</h1><p>Wildz is a free browser adventure built around living creature companions. Gather resources, build in the world, and carry your creatures’ cards and your adventure history with you.</p><Link prefetch={false} className={styles.play} href="/">Play at wildz.quest →</Link></header>
    <section><h2>What makes the world yours</h2><p>Creature collecting is the beginning. Learn your companions’ abilities, spend time exploring with them, and create a home that reflects how you like to play. Public profiles and shareable creature cards give your discoveries a place outside the game.</p><p>Wildz runs in a modern web browser with JavaScript and WebGL. Mobile touch controls and desktop controls make the same world accessible on different devices.</p></section>
    <section><h2>An open-source world</h2><p>The Wildz project is open source under the MIT license. Its code includes the game and its Receiz integration for identity, portable cards, and verified history.</p><p><a href="https://github.com/kojibai/wildz.quest">View the official source code on GitHub</a> or <a href="https://github.com/kojibai/wildz.quest/issues">report a game issue</a>.</p></section>
    <section><h2>Start with one discovery</h2><p>You do not need to understand every system to begin. Explore, follow a companion signal, and find a reason to return. Our <Link prefetch={false} href="/guide">beginner’s guide</Link> explains movement, gathering, building, companions, and saving your account.</p></section>
    <footer><Link prefetch={false} href="/">Play Wildz</Link><Link prefetch={false} href="/guide">Explorer’s guide</Link><Link prefetch={false} href="/laws">World law</Link></footer>
  </main>;
}
