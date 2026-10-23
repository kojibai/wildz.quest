"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { canonicalPortableCardJson } from "../play/portable-card";
import type { PublicWildzProfile } from "./public-profile";
import { fetchPublicWildzProfile } from "./public-profile-reader";
import { retainWildzProfilePage, retainedWildzProfilePage, type WildzProfilePageSeed } from "./profile-page-seed";
import { WildzProfileSheet } from "./WildzProfileSheet";

export function WildzPublicProfilePage({ username, initialSeed = null }: { username: string; initialSeed?: WildzProfilePageSeed | null }) {
  const [profile, setProfile] = useState<PublicWildzProfile | null>(() => initialSeed?.profile.username === username ? initialSeed.profile : null);
  const [status, setStatus] = useState("Loading explorer…");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const carried = initialSeed?.profile.username === username ? initialSeed : retainedWildzProfilePage(username);
    if (carried) { retainWildzProfilePage(carried); setProfile(carried.profile); }
    else { setProfile(null); setStatus("Loading explorer…"); }
    const isVisible = () => document.visibilityState !== "hidden";
    const refresh = async () => {
      if (!active || pending || !isVisible()) return;
      if (timer !== undefined) clearTimeout(timer);
      pending = true;
      controller = new AbortController();
      const deadline = setTimeout(() => controller?.abort(), 10_000);
      try {
        const value = await fetchPublicWildzProfile(username, globalThis.fetch, { signal: controller.signal });
        if (!active) return;
        if (value) retainWildzProfilePage({ profile: value, cards: carried?.cards ?? [], values: carried?.values ?? {}, artwork: carried?.artwork ?? {} });
        setProfile(previous => canonicalPortableCardJson(previous) === canonicalPortableCardJson(value) ? previous : value);
        setStatus(value ? "" : "This profile is not live yet. Its owner can open Profile in Wildz to publish it.");
      } catch {
        if (active) setStatus("The profile could not be loaded. Check your connection and try again.");
      } finally {
        clearTimeout(deadline);
        pending = false;
        if (active && isVisible()) timer = setTimeout(refresh, 5_000);
      }
    };
    const wake = () => { void refresh(); };
    if (initialSeed?.profile.username === username) timer = setTimeout(refresh, 5_000);
    else void refresh();
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      controller?.abort();
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [username, attempt, initialSeed]);
  return <main className="wildz-public-profile-page">
    <nav aria-label="Profile navigation"><Link href="/">← Enter Wildz</Link><span>{username}</span></nav>
    {profile ? <WildzProfileSheet key={profile.username} profile={profile} initialSeed={initialSeed?.profile.username === username ? initialSeed : undefined} /> : <section className="wildz-public-profile-empty"><h1>{username}</h1><p role="status">{status}</p>{status !== "Loading explorer…" && <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button>}</section>}
    <footer className="wildz-public-profile-links"><Link prefetch={false} href="/guide">How to play Wildz</Link><Link prefetch={false} href="/about">About the game</Link><Link prefetch={false} href="/laws">World law</Link></footer>
  </main>;
}
