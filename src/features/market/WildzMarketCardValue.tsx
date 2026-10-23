"use client";

import { useCallback, useEffect, useRef } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { WildzMarketOwnedCard } from "../../lib/receiz/wildz-market-collection";
import { formatWildsPhiExact, formatWildsUsdCents } from "../play/wallet/wilds-wallet-format";
import { formatWildzMarketValueChange } from "./wildz-market-value";
import styles from "./WildzMarketSheet.module.css";

export function CardValue({ card, onChart, onVisible, compact = false, href }: {
  card: WildzMarketOwnedCard;
  onChart?(): void;
  onVisible?(assetId: string): void;
  compact?: boolean;
  href?: string;
}) {
  const badge = useRef<HTMLElement | null>(null);
  const setBadge = useCallback((node: HTMLElement | null) => { badge.current = node; }, []);
  useEffect(() => {
    if (!onVisible || !badge.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); onVisible(card.assetId); }
    }, { rootMargin: "80px" });
    observer.observe(badge.current);
    return () => observer.disconnect();
  }, [card.assetId, card.proofDigest, onVisible]);
  const bps = card.value?.changeBps;
  const change = bps && /^-?(?:0|[1-9][0-9]*)$/.test(bps) ? BigInt(bps) : null;
  const content = <>{!compact ? <span>Proof value</span> : null}<div>
    <strong>{card.value ? (card.value.displayUsdCents === null ? `${formatWildsPhiExact(card.value.proofValuePhiMicro)} Φ` : formatWildsUsdCents(card.value.displayUsdCents)) : (card.valueUnavailable ? "Value unavailable" : "—")}</strong>
    {change !== null ? <small data-direction={change > 0n ? "up" : change < 0n ? "down" : "flat"} title="Change across the verified value chart window">{change > 0n ? <ArrowUpRight size={13} /> : change < 0n ? <ArrowDownRight size={13} /> : null}{formatWildzMarketValueChange(bps!)}</small> : null}
  </div></>;
  const props = { ref: setBadge, className: styles.tileValue, "data-market-value-asset": card.assetId, title: card.valueUnavailable };
  return href
    ? <a {...props} href={href} aria-label={onChart ? `View value chart · ${card.title}` : `Open ${card.title} standalone card · proof value`} onClick={onChart ? event => { event.preventDefault(); onChart(); } : undefined}>{content}</a>
    : <button {...props} type="button" aria-label={`View value chart · ${card.title}`} onClick={onChart}>{content}</button>;
}
