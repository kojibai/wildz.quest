import Link from "next/link";
import { publicPageMetadata } from "@/lib/wildz/search-metadata";
import styles from "./reader.module.css";

export const metadata = publicPageMetadata("How to Play Wildz — Creature Collecting & Building", "Start your free browser adventure in Wildz. Learn to explore, find creature companions, harvest resources, build a home, and save your progress.", "/guide");

export default function GuidePage() {
  return <main className={styles.page}>
    <nav aria-label="Site navigation"><Link prefetch={false} href="/">Wildz</Link><Link prefetch={false} href="/about">About the game</Link><Link prefetch={false} href="/laws">World law</Link></nav>
    <header><p className={styles.eyebrow}>THE EXPLORER’S FIELD GUIDE</p><h1>A world to explore.<br />A companion to remember.</h1><p>Wildz is a free creature-collecting adventure you play in your browser. Explore the world, meet living companions, and make a place of your own.</p><Link prefetch={false} className={styles.play} href="/">Play Wildz →</Link></header>
    <section aria-labelledby="first-steps"><h2 id="first-steps">Your first adventure</h2><ol>
      <li><h3>Explore and follow a signal</h3><p>Use the movement controls to travel. Watch the world map, mission panel, and nearby discoveries for places to investigate. On mobile, hold and drag the movement pad; on desktop, use the movement controls shown in the game.</p></li>
      <li><h3>Meet a creature companion</h3><p>Look for companion signals as you explore. Your collected creatures appear in the Companion Vault. Open a card to see its abilities, stats, and carried history, then choose a companion for your next outing.</p></li>
      <li><h3>Gather and build</h3><p>Find ready trees and stone sources, use the matching gathering ability, and open Build to see what your materials can make. Start with a small place you can return to, then expand as you explore.</p></li>
      <li><h3>Care for your companions</h3><p>Pay attention to your companion’s condition and abilities. Rest at camp when you need to recover. Training, bonding, and exploration give you different ways to spend time together.</p></li>
    </ol></section>
    <section><h2>Keep your adventure with you</h2><p>Open Profile to save your Identity Seal. It carries your account continuity and lets you restore your adventure on another device. Keep it private: someone with your seal can authenticate your account.</p><p>Public profile links and creature-card links let others view what you have published. A public card link is different from your private Identity Seal.</p></section>
    <section><h2>Questions before you play</h2>
      <details open><summary>Is Wildz free to play?</summary><p>Yes. You can enter Wildz and explore for free in a compatible browser. Marketplace listings and transfers are separate actions; you do not need to buy a card to start exploring.</p></details>
      <details><summary>Can I play on my phone?</summary><p>Wildz includes touch controls for mobile browsers and desktop controls for computers. Use an up-to-date browser with JavaScript and WebGL support. Performance depends on your device.</p></details>
      <details><summary>Do I need to install anything?</summary><p>No app-store download is required to open the browser game. If your browser offers installation, you can add Wildz to your home screen.</p></details>
      <details><summary>Is this a virtual pet game or a building game?</summary><p>Wildz combines creature collecting and companionship with exploration, resource gathering, and building. You can focus on your companions, a home, or your next discovery.</p></details>
      <details><summary>Does the whole game work offline?</summary><p>The live world and online actions need a connection. Cached public cards and profiles may remain readable offline. Save your Identity Seal before switching devices.</p></details>
    </section>
    <footer><Link prefetch={false} href="/">Enter the world</Link><Link prefetch={false} href="/about">About Wildz</Link><Link prefetch={false} href="/laws">Read the world law</Link></footer>
  </main>;
}
