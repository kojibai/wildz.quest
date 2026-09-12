"use client";

import type { WildsPlaytestController } from "./useWildsPlaytest";
import styles from "./WildsPlaytestPanel.module.css";

export function WildsPlaytestPanel({ playtest }: { playtest: WildsPlaytestController }) {
  return <section className={styles.panel} aria-label="Local playtest">
    <label className={styles.toggle}>
      <input type="checkbox" checked={playtest.enabled} onChange={event => playtest.setEnabled(event.target.checked)} />
      <span>Record a local playtest</span>
    </label>
    <p>Help find the moments that feel great or slow. Nothing is sent anywhere. Only this preference is saved; turning recording off clears this session.</p>
    {playtest.enabled && <>
      <dl className={styles.metrics}>
        <div><dt>Frame gaps over 50 ms</dt><dd>{playtest.summary.frameGapsOver50ms}</dd></div>
        <div><dt>Recent frame gap, 95th percentile</dt><dd>{playtest.summary.recentFrameP95Ms} ms</dd></div>
        <div><dt>Main thread tasks over 50 ms</dt><dd>{playtest.longTasksSupported ? playtest.summary.longTasks : "Unavailable"}</dd></div>
      </dl>
      <p>Visible-tab timing, not a GPU benchmark. Mark how a moment felt, then download the session to compare the same route after a change.</p>
      <div className={styles.actions}>
        <button type="button" onClick={() => playtest.mark("delight")}>That felt great</button>
        <button type="button" onClick={() => playtest.mark("hesitation")}>I felt stuck</button>
        <button type="button" onClick={playtest.download}>Download session</button>
        <button type="button" onClick={playtest.reset}>Start fresh</button>
      </div>
      <small>{playtest.summary.delighted} great moments · {playtest.summary.hesitations} stuck moments. Counts refresh every three seconds.</small>
    </>}
  </section>;
}
