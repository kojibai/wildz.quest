"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "@/components/icons";
import type { KaiKlokMoment } from "../kai-klok-moment";
import {
  deriveKaiMomentExpression,
  KAI_CHAKRA_ARKS,
  KAI_ETERNAL_MONTHS,
  KAI_HARMONIC_DAYS,
  KAI_HARMONIC_WEEKS,
  KAI_MATH_TEACHINGS,
  type KaiTeaching
} from "../kai-klok-teachings";

const INSPECTOR_ID = "wilds-kai-moment-inspector";

function TeachingGroup({ title, items, currentId }: {
  title: string;
  items: readonly KaiTeaching[];
  currentId: string;
}) {
  return <details className="wilds-kai-teaching-group">
    <summary>{title}<span>{items.length}</span></summary>
    <div>{items.map((item) => <article data-current={item.id === currentId ? "true" : "false"} key={item.id}>
      <header><strong>{item.name}</strong><small>{item.color}</small></header>
      <p>{item.meaning}</p>
      <dl><div><dt>Element</dt><dd>{item.element}</dd></div><div><dt>Geometry</dt><dd>{item.geometry}</dd></div></dl>
    </article>)}</div>
  </details>;
}

export function WildsKaiMomentInspector({ moment }: { moment: KaiKlokMoment }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const expression = useMemo(() => deriveKaiMomentExpression(moment), [moment]);

  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return <>
    <button
      aria-controls="wilds-kai-moment-inspector"
      aria-expanded={open}
      className="wilds-kai-inspector-trigger"
      onClick={() => setOpen((value) => !value)}
      ref={triggerRef}
      type="button"
    >
      <small>Eternal pulse</small>
      <strong>☤ KAI {moment.pulse.toLocaleString("en-US")}</strong>
      <span className="wilds-kai-moment-utterance">{expression.summary}</span>
      <Icons.chevronDown aria-hidden="true" className="wilds-kai-inspector-caret" size={14} />
    </button>

    {open ? <section
      aria-labelledby="wilds-kai-inspector-title"
      className="wilds-kai-inspector-popover"
      id={INSPECTOR_ID}
      role="dialog"
    >
      <header className="wilds-kai-inspector-head">
        <div><small>Living world time authority</small><h3 id="wilds-kai-inspector-title">☤ KAI · {moment.latticeCoordinate}</h3><p>{moment.coordinate}</p></div>
        <button aria-label="Close Kai moment inspector" onClick={close} ref={closeRef} type="button"><Icons.close aria-hidden="true" size={20} /></button>
      </header>

      <section className="wilds-kai-inspector-now" aria-labelledby="wilds-kai-now-title">
        <header><small id="wilds-kai-now-title">What this moment is saying</small><strong>{expression.day.name} · {expression.month.name} · {expression.ark.name}</strong></header>
        <p>{expression.summary}</p>
        <div><span>Year <b>{moment.year}</b></span><span>Month <b>{moment.month}</b></span><span>Day <b>{moment.day}</b></span><span>Week <b>{moment.week}</b></span></div>
      </section>

      <details className="wilds-kai-full-teaching" open>
        <summary>Full teaching</summary>
        <p>{expression.full}</p>
      </details>

      <TeachingGroup currentId={expression.day.id} items={KAI_HARMONIC_DAYS} title="Six harmonic days" />
      <TeachingGroup currentId={expression.week.id} items={KAI_HARMONIC_WEEKS} title="Seven harmonic weeks" />
      <TeachingGroup currentId={expression.month.id} items={KAI_ETERNAL_MONTHS} title="Eight eternal months" />
      <TeachingGroup currentId={expression.ark.id} items={KAI_CHAKRA_ARKS} title="Six chakra arks" />

      <details className="wilds-kai-teaching-group">
        <summary>Deterministic mathematics<span>{KAI_MATH_TEACHINGS.length}</span></summary>
        <ol className="wilds-kai-math">{KAI_MATH_TEACHINGS.map((teaching) => <li key={teaching}>{teaching}</li>)}</ol>
      </details>

      <details className="wilds-kai-teaching-group">
        <summary>Coordinate legend<span>5</span></summary>
        <dl className="wilds-kai-coordinate-legend">
          <div><dt>Y</dt><dd>Zero-based Kai year</dd></div>
          <div><dt>M</dt><dd>Eternal month, 1–8</dd></div>
          <div><dt>D</dt><dd>Harmonic day of the month, 1–42</dd></div>
          <div><dt>Beat:Step:Pulse</dt><dd>00–35 : 00–43 : 00–10</dd></div>
          <div><dt>KAI</dt><dd>Full continuous pulse since Genesis</dd></div>
        </dl>
      </details>
    </section> : null}
  </>;
}
