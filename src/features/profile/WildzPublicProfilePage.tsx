"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicWildzProfile } from "./public-profile";
import { fetchPublicWildzProfile } from "@/lib/receiz/wildz-profile-adapter";
import { WildzProfileSheet } from "./WildzProfileSheet";

export function WildzPublicProfilePage({ username }: { username: string }) {
  const [profile, setProfile] = useState<PublicWildzProfile | null>(null);
  const [status, setStatus] = useState("Loading explorer…");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setProfile(null);
    setStatus("Loading explorer…");
    void fetchPublicWildzProfile(username).then(value => {
      if (!active) return;
      setProfile(value);
      setStatus(value ? "" : "This profile is not live yet. Its owner can open Profile in Wildz to publish it.");
    }).catch(() => {
      if (active) setStatus("The profile could not be loaded. Check your connection and try again.");
    });
    return () => { active = false; };
  }, [username, attempt]);
  return <main className="wildz-public-profile-page">
    <nav aria-label="Profile navigation"><Link href="/">← Enter Wildz</Link><span>{username}</span></nav>
    {profile ? <WildzProfileSheet profile={profile} /> : <section className="wildz-public-profile-empty"><h1>{username}</h1><p role="status">{status}</p>{status !== "Loading explorer…" && <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button>}</section>}
  </main>;
}
