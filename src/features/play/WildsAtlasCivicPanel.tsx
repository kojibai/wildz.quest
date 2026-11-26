import { useState } from "react";
import { sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import {
  reviewWildsCityFootprint, wildsCityFoundingAnchors, wildsCityPopulation, wildsCityCellAt, wildsCityCellCenter,
  WILDS_CITY_MAX_CELLS, WILDS_CITY_RULES_DIGEST, WILDS_CLAN_RULES_DIGEST,
  type WildsCity, type WildsCityCell, type WildsCityCommand, type WildsCityFoundingAnchor
} from "./wilds-city";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsAtlasWorldAddition } from "./wilds-world-atlas";

export type WildsAtlasCivicMode = "territories" | "found" | "city" | "clans";

const explanations: Record<string, string> = {
  wilds_city_cells_invalid: "Choose connected ground around your first structure.",
  wilds_city_anchor_cell_required: "Include the ground beneath your first structure.",
  wilds_city_cells_disconnected: "Connect each plot to the rest of the city on at least one edge.",
  wilds_city_cell_route_protected: "A protected public trail crosses this plot. Choose another plot.",
  wilds_city_cell_landmark_protected: "This plot intersects a protected site.",
  wilds_city_cell_water: "Choose a plot on solid ground.",
  wilds_city_cell_overlap: "This plot already belongs to a city's stewardship area.",
  wilds_city_anchor_already_used: "This structure already anchors a city.",
  wilds_city_anchor_invalid: "Review the first structure and its recorded materials again.",
  wilds_city_revision_stale: "The city changed. Review its current record before trying again.",
  wilds_city_membership_required: "Join this city to take part in its governance.",
  wilds_city_vote_ineligible: "This proposal uses the voter list recorded when it opened.",
  wilds_clan_revision_stale: "The clan changed. Review its current record before trying again."
};

function civicError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return explanations[message] ?? "This action could not be recorded. Review the current details and try again.";
}

function identifies(left: string, right?: string) {
  return right !== undefined && (left === right || sameWildzPlayerCoordinate(left, right));
}

const plotOptions = [
  [-1, -1, "Northwest", "NW"], [0, -1, "North", "N"], [1, -1, "Northeast", "NE"],
  [-1, 0, "West", "W"], [0, 0, "First structure", "Home"], [1, 0, "East", "E"],
  [-1, 1, "Southwest", "SW"], [0, 1, "South", "S"], [1, 1, "Southeast", "SE"]
] as const;

export function WildsAtlasCivicPanel({ mode, world, cities, selectedCity, viewer, presenceCount, anchor, draft, onMode, onCity, onAnchor, onClearDraft, onBuild, submit, canInspect, onTogglePlot, buildings, onFocusBuilding, onTrackCity }: {
  mode: WildsAtlasCivicMode;
  world: WildsWorldProjection | null | undefined;
  cities: readonly WildsCity[];
  selectedCity?: WildsCity;
  viewer?: string;
  presenceCount: number;
  anchor?: WildsCityFoundingAnchor;
  draft: readonly WildsCityCell[];
  onMode: (mode: WildsAtlasCivicMode) => void;
  onCity: (cityId: string) => void;
  onAnchor: (anchor: WildsCityFoundingAnchor) => void;
  onClearDraft: () => void;
  onBuild?: () => void;
  submit?: (command: WildsCityCommand) => Promise<WildsWorldProjection>;
  canInspect: (position: { x: number; z: number }) => boolean;
  onTogglePlot: (cell: WildsCityCell) => void;
  buildings: readonly WildsAtlasWorldAddition[];
  onFocusBuilding: (position: { x: number; z: number }) => void;
  onTrackCity: (city: WildsCity) => void;
}) {
  const [cityName, setCityName] = useState("");
  const [clanName, setClanName] = useState("");
  const [proposalText, setProposalText] = useState("");
  const [cityTab, setCityTab] = useState<"overview" | "people" | "council">("overview");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const anchors = world && viewer && mode === "found" ? wildsCityFoundingAnchors(world, viewer).filter(item => canInspect(item.position)) : [];
  const review = world && anchor && mode === "found" ? reviewWildsCityFootprint(world, anchor, [...draft]) : null;
  const firstPlot = anchor ? wildsCityCellAt(anchor.position) : null;
  const commandId = () => `civic:${crypto.randomUUID()}`;
  const perform = async (command: WildsCityCommand, onResult?: (world: WildsWorldProjection) => void) => {
    if (!submit || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await submit(command);
      onResult?.(result);
      setStatus("Recorded on this device.");
    } catch (error) {
      setStatus(civicError(error));
    } finally {
      setBusy(false);
    }
  };

  const city = selectedCity;
  const resident = city && Object.keys(city.members).some(id => identifies(id, viewer));
  const applicant = city && Object.keys(city.applications).some(id => identifies(id, viewer));
  const founderIsResident = city && Object.keys(city.members).some(id => identifies(id, city.founderId));
  const cityBasis = city && { cityId: city.id, expectedRevision: city.revision, expectedHead: city.head };
  const proposal = city?.activeProposalId ? city.proposals[city.activeProposalId] : undefined;
  const didVote = proposal && Object.keys(proposal.votes).some(id => identifies(id, viewer));
  const mayVote = proposal && !didVote && proposal.electorate.some(id => identifies(id, viewer));

  return <>
    <div className="wilds-atlas-directory-tabs" role="group" aria-label="Civic atlas views">
      <button type="button" aria-pressed={mode === "territories" || mode === "city"} onClick={() => onMode("territories")}>Territories</button>
      <button type="button" aria-pressed={mode === "found"} onClick={() => onMode("found")}>Found a city</button>
      <button type="button" aria-pressed={mode === "clans"} onClick={() => onMode("clans")}>Clans</button>
    </div>
    <div className="wilds-atlas-inspector-scroll wilds-atlas-civic" key={`${mode}:${selectedCity?.id ?? ""}`}>
      {mode === "territories" ? <>
        <h3 tabIndex={-1}>Territories</h3>
        <p>Explore cities on charted land. Boundaries mark the ground a city stewards.</p>
        {cities.length ? <ul className="wilds-atlas-directory-list">{cities.map(item => <li key={item.id}>
          <button type="button" onClick={() => { setCityTab("overview"); onCity(item.id); }}>
            <span><strong>{item.name}</strong><small>{wildsCityPopulation(item)} residents{item.activeProposalId ? " · Open vote" : ""}</small></span>
          </button>
        </li>)}</ul> : <p>There are no recorded cities on your charted land yet.</p>}
        <p className="wilds-atlas-territory-key">Gold boundary · City stewardship</p>
      </> : null}
      {mode === "found" ? <>
        <h3 tabIndex={-1}>Found a city</h3>
        <p>Start with a structure you built using recorded materials. The surrounding plots give your city a place to care for and build together.</p>
        {anchors.length ? <form onSubmit={event => {
          event.preventDefault();
          if (!anchor || !review?.ok || !cityName.trim()) return;
          void perform({ type: "city.found", name: cityName, anchor: { kind: anchor.kind, id: anchor.id, head: anchor.head }, cells: review.cells,
            rulesDigest: WILDS_CITY_RULES_DIGEST, commandId: commandId() }, next => {
            const founded = Object.values(next.cities ?? {}).find(item => item.anchor.id === anchor.id && item.anchor.kind === anchor.kind);
            if (founded) { setCityName(""); onClearDraft(); onCity(founded.id); }
          });
        }}>
          <label>City name<input required maxLength={60} value={cityName} onChange={event => setCityName(event.target.value)} /></label>
          <label>First structure<select required value={anchor?.id ?? ""} onChange={event => {
            const item = anchors.find(candidate => candidate.id === event.target.value);
            if (item) onAnchor(item);
          }}>
            <option value="" disabled>Choose a structure</option>
            {anchors.map(item => <option key={item.id} value={item.id}>{item.label} · {Math.round(item.position.x)}, {Math.round(item.position.z)}</option>)}
          </select></label>
          {anchor ? <>
            <h4>Draw the stewardship area</h4>
            <p>Click adjoining plots on the map to add or remove them.</p>
            {firstPlot ? <div className="wilds-city-grid" role="group" aria-label="Plots around your first structure">
              {plotOptions.map(([x, z, label, short]) => {
                const plot = { x: firstPlot.x + x, z: firstPlot.z + z };
                return <button type="button" key={label} aria-label={`${label} plot`} aria-pressed={draft.some(item => item.x === plot.x && item.z === plot.z)}
                  disabled={busy || (!x && !z) || !canInspect(wildsCityCellCenter(plot))} onClick={() => onTogglePlot(plot)}>{short}</button>;
              })}
            </div> : null}
            <p aria-live="polite">{draft.length} of {WILDS_CITY_MAX_CELLS} plots selected. {review && !review.ok ? civicError(Error(review.reason)) : ""}</p>
            <button type="button" onClick={onClearDraft}>Reset to first plot</button>
          </> : null}
          <p>The charter keeps public trails and protected sites open. Residents decide maintenance priorities together.</p>
          <label className="wilds-atlas-civic-consent"><input type="checkbox" required /> Adopt the city charter</label>
          <button className="wilds-atlas-rift-action" type="submit" disabled={busy || !submit || !review?.ok}>Found city</button>
        </form> : <>
          <p>Complete a qualifying first structure before founding a city.</p>
          {onBuild ? <button type="button" onClick={onBuild}>Open build mode</button> : null}
        </>}
      </> : null}
      {mode === "city" && city && cityBasis ? <>
        <p className="wilds-atlas-inspector-kicker">Player-founded city</p>
        <h3 tabIndex={-1}>{city.name}</h3>
        <p>{wildsCityPopulation(city)} residents · {presenceCount} visible here now</p>
        <div className="wilds-atlas-civic-subtabs" role="group" aria-label="City views">
          <button type="button" aria-pressed={cityTab === "overview"} onClick={() => setCityTab("overview")}>Overview</button>
          <button type="button" aria-pressed={cityTab === "people"} onClick={() => setCityTab("people")}>People</button>
          <button type="button" aria-pressed={cityTab === "council"} onClick={() => setCityTab("council")}>Council</button>
        </div>
        {cityTab === "overview" ? <>
          <h4>Stewardship</h4>
          <p>{city.cells.length} connected plots · Founded around {city.anchor.label}</p>
          {city.maintenancePlan ? <p>{city.maintenancePlan}</p> : null}
          {buildings.length ? <>
            <h4>Structures</h4>
            <ul className="wilds-atlas-directory-list">{buildings.map(building => <li key={building.id}>
              <button type="button" disabled={!canInspect(building.position)} onClick={() => onFocusBuilding(building.position)}>
                <span><strong>{building.name ?? building.blueprint.replaceAll("-", " ")}</strong><small>{building.phase === "complete" ? "Completed" : `${Math.round(building.progress * 100)}% built`}</small></span>
              </button>
            </li>)}</ul>
          </> : null}
          <button type="button" onClick={() => onTrackCity(city)}>Track city on foot</button>
          {onBuild ? <button type="button" onClick={onBuild}>Build from the map</button> : null}
          <button type="button" onClick={() => onMode("clans")}>Browse clans</button>
        </> : null}
        {cityTab === "people" ? <>
          <h4>Residency</h4>
          {resident ? <button type="button" disabled={busy || !submit} onClick={() => void perform({ type: "city.residency.leave", ...cityBasis, commandId: commandId() })}>Leave city</button>
            : applicant ? <p>Residency requested.</p> : founderIsResident ? <button type="button" disabled={busy || !submit} onClick={() => void perform({ type: "city.residency.request", ...cityBasis, rulesDigest: WILDS_CITY_RULES_DIGEST, commandId: commandId() })}>Request residency</button> : <p>Residency applications are closed.</p>}
          <ul>{Object.keys(city.members).map(id => <li key={id}>{id}</li>)}</ul>
          {resident && identifies(city.founderId, viewer) && Object.keys(city.applications).length ? <>
            <h4>Applications</h4><ul className="wilds-atlas-directory-list">{Object.entries(city.applications).map(([id, item]) => <li key={id}>
              <button type="button" disabled={busy || !submit} onClick={() => void perform({ type: "city.residency.accept", ...cityBasis, applicantId: item.actorId, commandId: commandId() })}>Accept {id}</button>
            </li>)}</ul>
          </> : null}
        </> : null}
        {cityTab === "council" ? <>
          {proposal ? <>
            <h4>Open proposal</h4><p>{proposal.plan}</p>
            <p>{Object.values(proposal.votes).filter(vote => vote.vote === "yes").length} for · {Object.values(proposal.votes).filter(vote => vote.vote === "no").length} against · {proposal.electorate.length} eligible</p>
            {mayVote ? <div className="wilds-atlas-civic-vote">
              <button type="button" disabled={busy || !submit} onClick={() => void perform({ type: "city.proposal.vote", ...cityBasis, proposalId: proposal.id, vote: "yes", commandId: commandId() })}>Vote for</button>
              <button type="button" disabled={busy || !submit} onClick={() => void perform({ type: "city.proposal.vote", ...cityBasis, proposalId: proposal.id, vote: "no", commandId: commandId() })}>Vote against</button>
            </div> : <p>{didVote ? "Your vote is recorded." : "The voter list was set when this proposal opened."}</p>}
          </> : resident ? <form onSubmit={event => {
            event.preventDefault();
            if (proposalText.trim()) void perform({ type: "city.proposal.open", ...cityBasis, plan: proposalText, commandId: commandId() }, () => setProposalText(""));
          }}>
            <label>Propose a maintenance priority<textarea required maxLength={500} rows={3} value={proposalText} onChange={event => setProposalText(event.target.value)} /></label>
            <p>All eligible residents must approve. A vote records the agreed priority.</p>
            <button type="submit" disabled={busy || !submit}>Open vote</button>
          </form> : <p>No open proposal.</p>}
          {Object.values(city.proposals).some(item => item.status !== "open") ? <>
            <h4>Decisions</h4><ul>{Object.values(city.proposals).filter(item => item.status !== "open").map(item => <li key={item.id}>{item.plan} · {item.status}</li>)}</ul>
          </> : null}
        </> : null}
      </> : null}
      {mode === "clans" ? <>
        <h3 tabIndex={-1}>Clans</h3>
        {Object.values(world?.clans ?? {}).map(clan => {
          const member = Object.keys(clan.members).some(id => identifies(id, viewer));
          return <section className="wilds-atlas-charter" key={clan.id}>
            <h4>{clan.name}</h4><p>{Object.keys(clan.members).length} members</p>
            <button type="button" disabled={busy || !submit} onClick={() => {
              const base = { clanId: clan.id, expectedRevision: clan.revision, expectedHead: clan.head, commandId: commandId() };
              void perform(member ? { type: "clan.leave", ...base } : { type: "clan.join", ...base, rulesDigest: WILDS_CLAN_RULES_DIGEST });
            }}>{member ? "Leave clan" : "Join clan"}</button>
          </section>;
        })}
        <form onSubmit={event => {
          event.preventDefault();
          if (clanName.trim()) void perform({ type: "clan.create", name: clanName, rulesDigest: WILDS_CLAN_RULES_DIGEST, commandId: commandId() }, () => setClanName(""));
        }}>
          <label>Clan name<input required maxLength={60} value={clanName} onChange={event => setClanName(event.target.value)} /></label>
          <button type="submit" disabled={busy || !submit}>Found clan</button>
        </form>
      </> : null}
      {!submit && mode !== "territories" ? <p>Restore your Identity Seal to found, join, or vote.</p> : null}
      <p role="status">{busy ? "Recording…" : status}</p>
    </div>
  </>;
}
