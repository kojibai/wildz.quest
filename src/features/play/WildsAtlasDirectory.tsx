import Link from "next/link";
import { useState } from "react";
import { Icons } from "@/components/icons";
import type { WildsCivicProjection } from "./wilds-civic-history";
import type { WildsCommunity } from "./wilds-community";
import type { WildsCity, WildsCityCommand } from "./wilds-city";
import type { WildsCrewMapMarker } from "./wilds-crew-map";
import type { WildsLandmarkDefinition } from "./wilds-landmarks";
import { WAYFINDER_HOLLOW, type WildsSettlementDistrictId } from "./wilds-settlements";
import type { WildsAtlasProjection } from "./wilds-world-atlas";

const directoryTabs = ["places", "activity", "communities"] as const;
export type WildsAtlasDirectoryTab = typeof directoryTabs[number];
type AtlasPosition = { x: number; z: number };

const cityChange: Partial<Record<WildsCityCommand["type"], string>> = {
  "city.found": "City founded",
  "city.residency.request": "Residency requested",
  "city.residency.accept": "New resident",
  "city.residency.leave": "Residency ended",
  "city.proposal.open": "Proposal opened",
  "city.proposal.vote": "Council activity"
};

export function WildsAtlasDirectory({ tab, onTabChange, landmarks, projection, crewMarkers, communities, cities = [], onLandmark, onCity, onPoint, canInspect }: {
  tab: WildsAtlasDirectoryTab;
  onTabChange: (tab: WildsAtlasDirectoryTab) => void;
  landmarks: readonly WildsLandmarkDefinition[];
  projection: WildsAtlasProjection;
  crewMarkers: readonly WildsCrewMapMarker[];
  communities?: Readonly<Record<string, WildsCommunity>>;
  cities?: readonly WildsCity[];
  onLandmark: (id: string) => void;
  onCity?: (id: string) => void;
  onPoint: (label: string, position: AtlasPosition) => void;
  canInspect: (position: AtlasPosition) => boolean;
}) {
  const charters = Object.values(communities ?? {}).sort((left, right) => left.name.localeCompare(right.name));
  const liveCount = projection.exactPlayers.length + projection.playerClusters.reduce((sum, cluster) => sum + cluster.count, 0);
  const chartedBuilds = projection.worldAdditions.filter(build => canInspect(build.position));

  return <>
    <div className="wilds-atlas-directory-tabs" role="group" aria-label="Atlas index views">
      {directoryTabs.map(item => <button key={item} type="button" aria-pressed={item === tab} onClick={() => onTabChange(item)}>{item}</button>)}
    </div>
    <div className="wilds-atlas-inspector-scroll" key={tab}>
      {tab === "places" ? <>
        <h3 tabIndex={-1}>Charted places</h3>
        {landmarks.length ? <ul className="wilds-atlas-directory-list">
          {landmarks.map(landmark => <li key={landmark.id}>
            <button type="button" onClick={() => onLandmark(landmark.id)}>
              <span><strong>{landmark.name}</strong><small>{landmark.kind === "settlement" ? "Settlement · Browse districts" : landmark.subtitle}</small></span>
              <Icons.map aria-hidden="true" size={16} />
            </button>
          </li>)}
        </ul> : <p>Explore the Wildz to chart more places.</p>}
      </> : null}
      {tab === "activity" ? <>
        <h3 tabIndex={-1}>World activity</h3>
        <p>{liveCount} live {liveCount === 1 ? "explorer" : "explorers"} in this view</p>
        {cities.length && onCity ? <>
          <h4>City changes</h4>
          <ul className="wilds-atlas-directory-list">{[...cities].sort((a, b) => (b.history.at(-1)?.at ?? 0) - (a.history.at(-1)?.at ?? 0)).map(city => {
            const latest = city.history.at(-1);
            return <li key={city.id}><button type="button" onClick={() => onCity(city.id)}><span><strong>{city.name}</strong><small>{latest ? cityChange[latest.sourceEvent.payload.command.type] ?? "City record" : "City record"}</small></span></button></li>;
          })}</ul>
        </> : null}
        <h4>Creature expeditions</h4>
        {crewMarkers.length ? <ul className="wilds-atlas-directory-list">
          {crewMarkers.map(marker => <li key={`${marker.ownerId ?? "self"}:${marker.assetId}`}>
            <button type="button" onClick={() => onPoint(marker.name, marker.position)}><span><strong>{marker.name}</strong><small>{marker.status}{marker.ownerHandle ? ` · ${marker.ownerHandle}` : ""}</small></span><Icons.map aria-hidden="true" size={16} /></button>
          </li>)}
        </ul> : <p>No expeditions in charted territory.</p>}
        <h4>Discoveries in this view</h4>
        {projection.dynamicSites.length ? <ul className="wilds-atlas-directory-list">
          {projection.dynamicSites.map(site => <li key={site.id}>{site.visibility === "signal" ? <p>A discovery signal is nearby.</p> :
            <button type="button" onClick={() => onPoint(site.name, site.position)}><span><strong>{site.name}</strong><small>{site.visibility === "memorial" ? "Memorial" : site.phase.replaceAll("-", " ")}</small></span><Icons.map aria-hidden="true" size={16} /></button>}
          </li>)}
        </ul> : <p>No discovery activity in this view.</p>}
        <h4>Player builds</h4>
        {chartedBuilds.length ? <ul className="wilds-atlas-directory-list">
          {chartedBuilds.map(build => <li key={build.id}>
            <button type="button" onClick={() => onPoint(build.name ?? build.blueprint.replaceAll("-", " "), build.position)}>
              <span><strong>{build.name ?? build.blueprint.replaceAll("-", " ")}</strong><small>{build.phase === "complete" ? "Completed" : `${Math.round(build.progress * 100)}% built`}</small></span><Icons.map aria-hidden="true" size={16} />
            </button>
          </li>)}
        </ul> : <p>No player builds in charted territory.</p>}
      </> : null}
      {tab === "communities" ? <>
        <h3 tabIndex={-1}>Community charters</h3>
        {charters.length ? <ul className="wilds-atlas-directory-list">
          {charters.map(charter => <li key={charter.id}><article className="wilds-atlas-charter">
            <h4>{charter.name}</h4>
            <p>{Object.keys(charter.members).length} members · {Object.values(charter.allocations).filter(place => place.status === "allocated").length}/{charter.capacity} participation places filled</p>
            <p>{charter.capacityPlan}</p>
            {charter.proposal ? <details open><summary>Open capacity proposal · {charter.proposal.approvals.length}/{charter.proposal.electorate.length} approvals</summary>
              <p>{charter.capacity} → {charter.proposal.capacity} participation places</p><p>{charter.proposal.plan}</p>
              <p>Every member in this vote must approve.</p>
            </details> : null}
            <details><summary>Charter history</summary><ol>{charter.adoptions.map((entry, index) => <li key={`${entry.at}:${index}`}>{index === 0 ? "Adopted" : "Amended"} · {entry.capacity} places · Kai {entry.at}</li>)}</ol></details>
            <Link prefetch={false} href={`/laws/community?charter=${encodeURIComponent(charter.id)}`}>Open charter procedures</Link>
          </article></li>)}
        </ul> : <p>No community charter records in this atlas yet.</p>}
        <Link prefetch={false} href="/laws/community">Find or start a community</Link>
      </> : null}
    </div>
  </>;
}

export function WildsAtlasSettlement({ civic, onFocus }: { civic: WildsCivicProjection; onFocus: (position: AtlasPosition) => void }) {
  const [districtId, setDistrictId] = useState<WildsSettlementDistrictId | null>(null);
  return <div className="wilds-atlas-settlement">
    <h4>Districts</h4>
    <ul className="wilds-atlas-directory-list">
      {WAYFINDER_HOLLOW.districts.map(district => <li key={district.id}>
        <button type="button" aria-pressed={districtId === district.id} onClick={() => {
          setDistrictId(district.id);
          onFocus({ x: WAYFINDER_HOLLOW.position.x + district.position[0], z: WAYFINDER_HOLLOW.position.z + district.position[1] });
        }}><span><strong>{district.name}</strong><small>{district.purpose}</small></span><Icons.map aria-hidden="true" size={16} /></button>
        {districtId === district.id ? WAYFINDER_HOLLOW.residents.filter(resident => resident.districtId === district.id).map(resident => <p className="wilds-atlas-resident" key={resident.id}>{resident.name} · {resident.title}</p>) : null}
      </li>)}
    </ul>
    <h4>Your settlement history</h4>
    {civic.events.length ? <p className="wilds-atlas-settlement-rank">{civic.rank} · {civic.reputation} reputation · {civic.completedSourceIds.length} milestones</p> : <p>Visit and meet the residents to begin your history here.</p>}
  </div>;
}
