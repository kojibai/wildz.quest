"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Leaf, ShieldCheck } from "lucide-react";
import styles from "./world-law.module.css";

const tabs = ["Overview", "World rules", "Source text"] as const;
export function WorldLawReader({ source, version, digest, laws }: { source: string; version: string; digest: string; laws: string[] }) {
  const [tab, setTab] = useState(0);
  const [chapter, setChapter] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const tabButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const sections = source.split(/\n⸻\n/).map(text => text.trim()).filter(Boolean);
  const selectTab = (index: number) => { setTab(index); panel.current?.scrollTo({ top: 0 }); };
  const selectChapter = (index: number) => { setChapter(index); panel.current?.scrollTo({ top: 0 }); };
  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.topline}><Link href="/"><ArrowLeft size={15} aria-hidden="true" /> Return to Wildz</Link><span>THE LIVING WORLD</span></div>
        <div className={styles.hero}><div className={styles.seal}><Leaf size={32} strokeWidth={1.3} aria-hidden="true" /></div><div><p className={styles.eyebrow}>TRUTH OF BREATH</p><h1>World law<span>.</span></h1><p className={styles.subtitle}>A shared world. A promise to one another.</p></div></div>
      </header>
      <div className={styles.tabs} role="tablist" aria-label="World law sections">
        {tabs.map((label, index) => <button key={label} ref={element => { tabButtons.current[index] = element; }} type="button" role="tab" id={`law-tab-${index}`} aria-selected={tab === index} aria-controls="law-panel" tabIndex={tab === index ? 0 : -1} onClick={() => selectTab(index)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
          if (next === null) return;
          event.preventDefault(); selectTab(next); tabButtons.current[next]?.focus();
        }}>{label}</button>)}
      </div>
      <section className={styles.reader}>
        <div className={styles.readerHeading}><span><BookOpen size={15} aria-hidden="true" /> {tab === 0 ? "THE PRINCIPLES" : tab === 1 ? "CONNECTED TRANSITION LAWS" : "THE ORIGINAL CONSTITUTION"}</span><span>{tab === 2 ? `${chapter + 1} / ${sections.length}` : `V${version}`}</span></div>
        {tab === 2 && <label className={styles.chapterSelect}>Read a section<select aria-label="Constitution section" value={chapter} onChange={event => selectChapter(Number(event.target.value))}>{sections.map((section, index) => <option key={index} value={index}>{section.split("\n")[0]}</option>)}</select></label>}
        <div ref={panel} className={styles.content} id="law-panel" role="tabpanel" aria-labelledby={`law-tab-${tab}`} tabIndex={0}>
          {tab === 0 ? <>
            <p className={styles.lead}>No status stands above the law.</p>
            <p>Every defined world command must pass its source rules. Its receipt identifies the actor, source state, authority, predicates and successor.</p>
            <div className={styles.principles}>
              <article><span>01 / EQUAL STANDING</span><h2>Authority must be earned.</h2><p>A founder, administrator, majority or machine receives no override through status alone.</p></article>
              <article><span>02 / STEWARDSHIP</span><h2>Build with the world.</h2><p>Construction owns produced improvements; it grants no absolute title to Earth.</p></article>
              <article><span>03 / EVIDENCE</span><h2>A claim is a beginning.</h2><p>Claims remain allegations until evidence and a defined finding establish more. Competing published branches remain disputed.</p></article>
              <article><span>04 / DEFINED RULES</span><h2>No unwritten powers.</h2><p>Rules without adopted decision predicates grant no executable authority.</p></article>
            </div>
          </> : tab === 1 ? <>
            <p className={styles.lead}>Every action has a source.</p><p>These laws connect to the world’s defined commands.</p>
            <ol className={styles.laws}>{laws.map((law, index) => <li key={law}><span>{String(index + 1).padStart(2, "0")}</span><b>{law.replaceAll(".", " · ").replaceAll("-", " ")}</b><ShieldCheck size={16} aria-hidden="true" /></li>)}</ol>
            <aside className={styles.note}><h2>Still to be adopted</h2><p>Community allocation, abandonment thresholds, guardianship appointments, adjudication, remedies, insolvency and ratification still require explicit adopted procedures. The current game does not execute those transitions.</p><p>The constitutional predicate library can evaluate supplied source facts; it does not establish them or issue human standing.</p></aside>
          </> : <div className={styles.sourceText}>{sections[chapter]}</div>}
        </div>
        {tab === 2 && <nav className={styles.chapterNav} aria-label="Constitution chapters"><button type="button" disabled={chapter === 0} onClick={() => selectChapter(chapter - 1)}><ArrowLeft size={15} aria-hidden="true" /> Previous</button><button type="button" disabled={chapter === sections.length - 1} onClick={() => selectChapter(chapter + 1)}>Next <ArrowRight size={15} aria-hidden="true" /></button></nav>}
      </section>
      <footer className={styles.footer}><span><ShieldCheck size={14} aria-hidden="true" /> Source constitution · v{version}</span><span title={digest} aria-label={`Source digest ${digest}`}>{digest.slice(0, 19)}…</span></footer>
    </div>
  </main>;
}
