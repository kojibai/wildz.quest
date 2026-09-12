"use client";
import type { WildsCompanionChapter as Chapter } from "./wilds-companion-chapter";
import styles from "./WildsWorldStories.module.css";

export function WildsCompanionChapter({ chapter, onFindPlace }: {
  chapter: Chapter;
  onFindPlace: (position: Readonly<{ x: number; z: number }>, kind: "meeting" | "discovery") => void;
}) {
  return <section className={styles.story} aria-label="Your companion's story">
    <span className={styles.eyebrow}>A shared history</span>
    <h4>You and {chapter.companionName}</h4>
    {chapter.revisit && <p><strong>Back together.</strong> {chapter.revisit.text}</p>}
    {chapter.firstMeeting && <p>{chapter.firstMeeting.text}</p>}
    <p className={styles.note}>{chapter.sharedPlaces ? `${chapter.sharedPlaces} shared ${chapter.sharedPlaces === 1 ? "place" : "places"} in your explorer journal.` : "Explore, gather, or build together to begin your shared journal."}</p>
    {chapter.opportunity && <p>{chapter.opportunity.text}</p>}
    <div className={styles.actions}>
      {chapter.firstMeeting && <button type="button" onClick={() => onFindPlace(chapter.firstMeeting!.position, "meeting")}>Find where you met</button>}
      {chapter.opportunity && <button type="button" onClick={() => onFindPlace(chapter.opportunity!.position, "discovery")}>Find a trail for you both</button>}
    </div>
  </section>;
}
