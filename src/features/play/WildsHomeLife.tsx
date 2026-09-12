"use client";
import type { WildsHomeAction, WildsHomeLife as HomeLife } from "./wilds-home-life";
import styles from "./WildsWorldStories.module.css";

export function WildsHomeLife({ home, onAction }: { home: HomeLife; onAction: (action: WildsHomeAction, structureId: string, companionId?: string) => void }) {
  return <section className={styles.story} aria-label="Home activities">
    <span className={styles.eyebrow}>A reason to return</span>
    <h4>{home.title}</h4><p>{home.routine}</p>
    {home.companion && <p className={styles.note}>Today&apos;s companion suggestion: {home.companion.name}</p>}
    <div className={styles.actions}>{home.activities.map(activity => <button key={activity.action} type="button" onClick={() => onAction(activity.action, activity.structureId, home.companion?.id)}>
      <strong>{activity.label}</strong><span>{activity.reason}</span>
    </button>)}</div>
  </section>;
}
