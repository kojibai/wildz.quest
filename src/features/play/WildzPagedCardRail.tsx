"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "@/components/icons";
import { sortWildzCards, type WildzCardSort } from "./card-sort";
import { creatureForm } from "./creature-catalog";
import type { PlayState } from "./game-state";
import { clampInventoryPage, inventoryPageSize, rebaseInventoryPage } from "./inventory-pagination";
import type { PortableCardAsset } from "./portable-card";
import { WildsCreatureThumbnail } from "./WildsCreatureThumbnail";
import { WildsVerifiedBadge } from "./WildsVerifiedBadge";

export const WildzPagedCardRail = memo(function WildzPagedCardRail({
  nearbyCards,
  companionProgress,
  cardOrder,
  onCardOrderChange,
  onSelectCard,
  onOpenMarket
}: {
  nearbyCards: readonly PortableCardAsset[];
  companionProgress: PlayState["companionProgress"];
  cardOrder: WildzCardSort;
  onCardOrderChange: (order: WildzCardSort) => void;
  onSelectCard: (assetId: string) => void;
  onOpenMarket: () => void;
}) {
  const [compact, setCompact] = useState(false);
  const [page, setPage] = useState(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swipeLatest = useRef<{ x: number; y: number } | null>(null);
  const suppressCardClick = useRef(false);
  const suppressCardClickReset = useRef<number | null>(null);
  const cardsElement = useRef<HTMLDivElement>(null);
  const sortedCards = useMemo(() => sortWildzCards(nearbyCards, cardOrder), [cardOrder, nearbyCards]);
  const pageSize = inventoryPageSize(compact);
  const previousPageSize = useRef(pageSize);
  const pages = Math.max(1, Math.ceil(sortedCards.length / pageSize));
  const safePage = clampInventoryPage(page, sortedCards.length, pageSize);
  const visibleCards = sortedCards.slice(safePage * pageSize, safePage * pageSize + pageSize);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setPage((current) => rebaseInventoryPage(current, previousPageSize.current, pageSize, sortedCards.length));
    previousPageSize.current = pageSize;
  }, [pageSize, sortedCards.length]);

  useEffect(() => () => {
    if (suppressCardClickReset.current !== null) {
      window.clearTimeout(suppressCardClickReset.current);
    }
  }, []);

  useEffect(() => {
    setPage(0);
  }, [cardOrder]);

  useEffect(() => {
    if (cardsElement.current) cardsElement.current.scrollLeft = 0;
  }, [safePage]);

  const changePage = (nextPage: number) => {
    setPage(clampInventoryPage(nextPage, sortedCards.length, pageSize));
  };

  const resetSwipe = (target: HTMLElement, pointerId?: number) => {
    swipeStart.current = null;
    swipeLatest.current = null;
    if (pointerId !== undefined && target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
  };

  const clearCardClickSuppression = () => {
    suppressCardClick.current = false;
    if (suppressCardClickReset.current !== null) {
      window.clearTimeout(suppressCardClickReset.current);
      suppressCardClickReset.current = null;
    }
  };

  const suppressSyntheticCardClick = () => {
    clearCardClickSuppression();
    suppressCardClick.current = true;
    suppressCardClickReset.current = window.setTimeout(() => {
      suppressCardClick.current = false;
      suppressCardClickReset.current = null;
    }, 0);
  };

  const endSwipe = (target: HTMLElement, pointerId: number) => {
    const start = swipeStart.current;
    const end = swipeLatest.current;
    resetSwipe(target, pointerId);
    if (!start || !end) return;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    suppressSyntheticCardClick();
    changePage(safePage + (dx < 0 ? 1 : -1));
  };

  const activateCard = (assetId: string) => {
    if (suppressCardClick.current) {
      clearCardClickSuppression();
      return;
    }
    onSelectCard(assetId);
  };

  const openMarket = () => {
    if (suppressCardClick.current) {
      clearCardClickSuppression();
      return;
    }
    onOpenMarket();
  };

  return (
    <section
      aria-label={`${nearbyCards.length} sealed companion${nearbyCards.length === 1 ? "" : "s"}. Card rail page ${safePage + 1} of ${pages}.`}
      className="wildz-card-rail"
    >
      <div className="wildz-card-rail-tools">
        <span>{nearbyCards.length} sealed companion{nearbyCards.length === 1 ? "" : "s"}</span>
        <div className="wildz-card-page-controls" aria-label="Card rail pages">
          <button aria-label="Previous card rail page" disabled={safePage === 0} onClick={() => changePage(safePage - 1)} type="button">
            <Icons.chevronLeft aria-hidden="true" size={15} />
          </button>
          <span aria-live="polite">Page {safePage + 1} of {pages}</span>
          <button aria-label="Next card rail page" disabled={safePage + 1 >= pages} onClick={() => changePage(safePage + 1)} type="button">
            <Icons.chevronRight aria-hidden="true" size={15} />
          </button>
        </div>
        <label><span>Sort</span><select
          aria-label="Sort card rail"
          onChange={(event) => {
            setPage(0);
            onCardOrderChange(event.target.value as WildzCardSort);
          }}
          value={cardOrder}
        >
          <option value="rarity">Rarity</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select></label>
      </div>
      <div
        aria-label={`Cards ${visibleCards.length ? safePage * pageSize + 1 : 0} through ${safePage * pageSize + visibleCards.length} of ${sortedCards.length}`}
        className="wildz-card-page"
        onLostPointerCapture={(event) => resetSwipe(event.currentTarget)}
        onPointerCancel={(event) => resetSwipe(event.currentTarget)}
        onPointerDown={(event) => {
          clearCardClickSuppression();
          swipeStart.current = { x: event.clientX, y: event.clientY };
          swipeLatest.current = swipeStart.current;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!swipeStart.current) return;
          swipeLatest.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => endSwipe(event.currentTarget, event.pointerId)}
        role="region"
      >
        <div className="wildz-nearby-cards" ref={cardsElement} role="list">
          {visibleCards.map((card, index) => {
            const form = creatureForm(card.manifest.formId);
            const progress = companionProgress[card.manifest.familyId] ?? { level: 1, xp: 0, bond: 0 };
            const logicalPosition = safePage * pageSize + index + 1;
            return <article
              aria-label={`${card.manifest.name}, card ${logicalPosition} of ${sortedCards.length}`}
              aria-posinset={logicalPosition}
              aria-setsize={sortedCards.length}
              data-wildz-card-id={card.id}
              key={card.id}
              role="listitem"
            >
              <button className="wildz-nearby-creature" onClick={() => activateCard(card.id)} type="button">
                <WildsCreatureThumbnail asset={card} className="wildz-creature-portrait" />
                <div>
                  <span className="wildz-nearby-xp">{progress.xp} XP</span>
                  <strong className="wilds-creature-name"><span>{card.manifest.name}</span><WildsVerifiedBadge /></strong>
                  <small>Lv. {progress.level} · Bond {progress.bond} · Stage {card.manifest.stage} · {form?.element ?? card.manifest.species}</small>
                  <em>{form?.temperament ?? card.manifest.rarity}</em>
                </div>
              </button>
              <div className="wildz-nearby-owner"><Icons.user size={18} /><span><strong>{card.manifest.ownerReceizId}</strong></span></div>
              <button className="wildz-trade-inline" onClick={openMarket} type="button"><b>{card.manifest.stats.power} PWR</b><span>Trade</span></button>
            </article>;
          })}
          {!visibleCards.length ? <p className="wildz-card-rail-empty">No sealed companions yet.</p> : null}
        </div>
      </div>
    </section>
  );
});
