"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Leaf, ShieldCheck } from "lucide-react";
import type { ExplainedRule } from "./rule-details";
import styles from "./world-law.module.css";

const tabs = ["Overview", "World rules", "Source text"] as const;
export function WorldLawReader({ source, version, digest, rules }: { source: string; version: string; digest: string; rules: ExplainedRule[] }) {
  const [tab, setTab] = useState(0);
  const [chapter, setChapter] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
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
            <p className={styles.lead}>Every action has a source.</p><p>Choose an action to understand its requirements, outcomes and limits. Open the verification details when you want to go deeper.</p>
            <p className={styles.ruleCount}>{rules.length} rule families · {rules.reduce((total, rule) => total + rule.commands.length, 0)} connected actions</p>
            <ol className={styles.laws}>{rules.map((rule, index) => {
              const open = expanded === rule.id;
              return <li key={rule.id} className={open ? styles.expanded : undefined}>
                <h2><button type="button" id={`rule-${index}`} aria-expanded={open} aria-controls={`rule-detail-${index}`} onClick={() => setExpanded(open ? null : rule.id)}>
                  <span className={styles.ruleNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.ruleLabel}><b>{rule.title}</b><small>{rule.summary}</small></span>
                  <ChevronDown size={18} aria-hidden="true" />
                </button></h2>
                <div id={`rule-detail-${index}`} role="region" aria-labelledby={`rule-${index}`} hidden={!open} className={styles.ruleDetail}>
                  <dl><dt>Before you act</dt><dd>{rule.requirements}</dd><dt>When accepted</dt><dd>{rule.success}</dd><dt>When it cannot proceed</dt><dd>{rule.blocked}</dd></dl>
                  <aside className={styles.example}><strong>In the world</strong><p>{rule.example}</p></aside>
                  {open && <details className={styles.verification}><summary>Go deeper · verification & connected actions</summary>
                    <p>Rule reference: <code>{rule.id}</code>. These are the commands connected to this rule family; each keeps its own resource-specific checks.</p>
                    <ul>{rule.commands.map(command => <li key={command}><code>{command}</code></li>)}</ul>
                    <h3>How the decision is recorded</h3><p>The constitutional decision binds the identified actor, the starting world state and the requested command. It records the checks and, when supplied, the resulting state. A failed check is not permission to continue; an unresolved check is not treated as proven.</p>
                    <p>Shared references: TOB-01/81 (identity), TOB-03/23/74 (defined authority), TOB-05/13/59 (limits on ownership), TOB-60/62 (source binding), and TOB-81/84 (transition checks). Accepted local execution and durable publication are separate steps; this reader does not verify your live sync status.</p>
                    <button type="button" className={styles.sourceLink} onClick={() => selectTab(2)}>Read the original constitution <ArrowRight size={14} aria-hidden="true" /></button>
                  </details>}
                </div>
              </li>;
            })}</ol>
            <aside className={styles.note}><h2>Put the procedures into practice</h2><p>All seven community procedures have defined executable transitions: allocation, inactivity review, limited guardianship, adjudication, remedies, work-obligation relief and ratification. Each community adopts the versioned charter explicitly; adoption is recorded, never assumed for other players.</p><p>Participation places follow request order. Inactivity review starts after 30 Kai days, with seven Kai days to return. Delegation expires after 30 Kai days and can be revoked sooner. Findings require the parties’ consent to an independent reviewer and allow seven Kai days for appeal. Capacity amendments require every current member’s approval.</p><p>These procedures govern voluntary community participation and non-monetary work obligations. They do not establish human incapacity, promise physical housing, adjudicate real-world debt, or grant authority over wallets and cards.</p><Link prefetch={false} href="/laws/community" className={styles.sourceLink}>Open community procedures <ArrowRight size={14} aria-hidden="true" /></Link></aside>
          </> : <div className={styles.sourceText}>{sections[chapter]}</div>}
        </div>
        {tab === 2 && <nav className={styles.chapterNav} aria-label="Constitution chapters"><button type="button" disabled={chapter === 0} onClick={() => selectChapter(chapter - 1)}><ArrowLeft size={15} aria-hidden="true" /> Previous</button><button type="button" disabled={chapter === sections.length - 1} onClick={() => selectChapter(chapter + 1)}>Next <ArrowRight size={15} aria-hidden="true" /></button></nav>}
      </section>
      <footer className={styles.footer}><span><ShieldCheck size={14} aria-hidden="true" /> Source constitution · v{version}</span><span title={digest} aria-label={`Source digest ${digest}`}>{digest.slice(0, 19)}…</span></footer>
    </div>
  </main>;
}
