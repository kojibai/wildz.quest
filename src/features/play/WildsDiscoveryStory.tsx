"use client";
import type { projectWildsDiscoveryStory } from "./wilds-discovery-story";
import styles from "./WildsWorldStories.module.css";

export function WildsDiscoveryStory({ discovery, onExplore }: { discovery: ReturnType<typeof projectWildsDiscoveryStory>; onExplore: (siteKey: string) => void }) {
  return <section className={styles.story} aria-label="Discovery story">
    <span className={styles.eyebrow}>From the field guide</span>
    <h4>{discovery.title}</h4><p>{discovery.story}</p>
    <p className={styles.note}>{discovery.progressLabel}</p>
    <p>{discovery.objective}</p><p className={styles.note}>{discovery.approachHint}</p><p className={styles.note}>{discovery.routeHint}</p>
    <div className={styles.actions}><button type="button" onClick={() => onExplore(discovery.siteKey)}>{discovery.actionLabel}</button></div>
  </section>;
}
