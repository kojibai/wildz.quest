"use client";

import type { PublicWildzProfile } from "@/features/profile/public-profile";
import { WildzVaultSheet } from "@/features/profile/WildzVaultSheet";
import { Camera, Check, Download, Link, LoaderCircle, Pencil, Share2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import {
  copyWildzProfileLink,
  shareWildzProfile,
  type WildzSharePort,
  type WildzShareResult
} from "./profile-sharing";

async function profileImageFromFile(file: File) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) throw new Error("Choose a PNG, JPEG, or WebP under 8 MB.");
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("That image could not be read."));
      element.src = source;
    });
    const size = Math.min(384, Math.max(1, image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("That image could not be prepared.");
    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    const encoded = canvas.toDataURL("image/webp", .82);
    if (encoded.length > 220_000) throw new Error("Choose a simpler or smaller image.");
    return encoded;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function WildzProfileSheet({ profile, publicationStatus = "published", shareEnabled = true, editable = false, signingAvailable = true, onAuthenticateIdentitySeal, onSaveIdentitySeal, onSaveProfile }: {
  profile: PublicWildzProfile;
  publicationStatus?: "local" | "published";
  shareEnabled?: boolean;
  editable?: boolean;
  signingAvailable?: boolean;
  onAuthenticateIdentitySeal?: (file: File) => Promise<void>;
  onSaveIdentitySeal?: () => Promise<void>;
  onSaveProfile?: (input: { username: string; displayName: string; avatarImageUrl: string | null }) => Promise<void>;
}) {
  const [shareResult, setShareResult] = useState<WildzShareResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftUsername, setDraftUsername] = useState(profile.username.replace(/^@/, ""));
  const [draftDisplayName, setDraftDisplayName] = useState(profile.displayName);
  const [draftAvatar, setDraftAvatar] = useState(profile.avatarImageUrl);
  const [editMessage, setEditMessage] = useState("");
  const [identitySealSaving, setIdentitySealSaving] = useState(false);
  const [identityAuthenticating, setIdentityAuthenticating] = useState(false);
  const [identityMessage, setIdentityMessage] = useState("");
  const identityInputRef = useRef<HTMLInputElement>(null);
  const browserPort = (): WildzSharePort => ({
    share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
    clipboard: navigator.clipboard?.writeText
      ? { writeText: (value) => navigator.clipboard.writeText(value) }
      : undefined
  });
  const share = async () => setShareResult(await shareWildzProfile({
    port: browserPort(),
    username: profile.username,
    displayName: profile.displayName,
    origin: window.location.origin
  }));
  const copy = async () => setShareResult(await copyWildzProfileLink({
    port: browserPort(),
    username: profile.username,
    origin: window.location.origin
  }));

  const cancelEdit = () => {
    setDraftUsername(profile.username.replace(/^@/, ""));
    setDraftDisplayName(profile.displayName);
    setDraftAvatar(profile.avatarImageUrl);
    setEditMessage("");
    setEditing(false);
  };
  const save = async () => {
    const username = draftUsername.trim().replace(/^@+/, "").toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(username)) {
      setEditMessage("Use 1–64 letters, numbers, dots, dashes, or underscores.");
      return;
    }
    if (!onSaveProfile) return;
    setSaving(true);
    setEditMessage("Checking Receiz and securing this name…");
    try {
      await onSaveProfile({ username, displayName: draftDisplayName.trim() || "Wildz Explorer", avatarImageUrl: draftAvatar });
      setEditMessage("Profile secured and saved.");
      window.setTimeout(() => setEditing(false), 500);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      setEditMessage(code === "wildz_username_taken"
        ? "That Receiz username is already claimed."
        : code === "wildz_username_claim_unverified"
          ? "Receiz did not confirm that name. Nothing changed."
          : "Receiz could not verify this update. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="wildz-profile-sheet">
    <header className="wildz-profile-head"><div className="wildz-profile-avatar">{draftAvatar ? <Image alt="" height={58} src={draftAvatar} unoptimized width={58} /> : profile.displayName.slice(0, 2).toUpperCase()}</div><div>
      <span>Explorer profile</span><h2>{profile.displayName}</h2><p>{profile.username} · {publicationStatus === "published" ? "Published via Receiz" : "Local verified profile · not yet published"}</p>
    </div>{editable ? <button className="wildz-profile-edit-trigger" aria-label="Edit profile" aria-pressed={editing} onClick={() => setEditing((value) => !value)} type="button"><Pencil aria-hidden="true" size={18} /></button> : null}</header>
    {editable && editing ? <section className="wildz-profile-editor" aria-label="Edit explorer profile" aria-busy={saving}>
      <label className="wildz-profile-photo-control">
        <span>{draftAvatar ? <Image alt="Profile preview" height={58} src={draftAvatar} unoptimized width={58} /> : <Camera aria-hidden="true" size={22} />}</span>
        <input accept="image/png,image/jpeg,image/webp" disabled={saving} type="file" onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setEditMessage("Preparing image…");
          void profileImageFromFile(file).then((image) => {
            setDraftAvatar(image);
            setEditMessage("");
          }).catch((cause) => setEditMessage(cause instanceof Error ? cause.message : "That image could not be prepared."));
        }} />
      </label>
      <label><span>Username</span><div className="wildz-profile-username-field"><i>@</i><input autoCapitalize="none" autoComplete="username" disabled={saving} maxLength={64} onChange={(event) => setDraftUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))} spellCheck={false} value={draftUsername} /></div></label>
      <label><span>Name</span><input disabled={saving} maxLength={80} onChange={(event) => setDraftDisplayName(event.target.value)} value={draftDisplayName} /></label>
      <div className="wildz-profile-editor-actions">
        <button aria-label="Cancel profile editing" disabled={saving} onClick={cancelEdit} type="button"><X aria-hidden="true" size={18} /></button>
        <button aria-label="Save profile" data-state={saving ? "working" : "idle"} disabled={saving} onClick={() => void save()} type="button">{saving ? <LoaderCircle aria-hidden="true" size={18} /> : <Check aria-hidden="true" size={18} />}</button>
      </div>
      <p aria-live="polite" role="status">{editMessage}</p>
    </section> : null}
    <section className="wildz-profile-action-rail" aria-label="Profile actions">
      <button aria-label="Share profile" data-state={shareResult?.status === "shared" ? "success" : "idle"} disabled={!shareEnabled} onClick={() => void share()} title="Share profile" type="button"><Share2 aria-hidden="true" size={18} /></button>
      <button aria-label="Copy profile link" data-state={shareResult?.status === "copied" ? "success" : "idle"} disabled={!shareEnabled} onClick={() => void copy()} title="Copy profile link" type="button"><Link aria-hidden="true" size={18} /></button>
      {editable ? <>
      <button
        aria-busy={identityAuthenticating}
        aria-label="Upload Identity Seal or Record"
        data-state={identityAuthenticating ? "working" : "idle"}
        disabled={identitySealSaving || identityAuthenticating || !onAuthenticateIdentitySeal}
        onClick={() => {
          setIdentityMessage("Choose the Identity Seal or Record that activates this Receiz ID.");
          identityInputRef.current?.click();
        }}
        title="Upload Identity Seal or Record"
        type="button"
      ><Upload aria-hidden="true" size={18} /></button>
      <button
        aria-busy={identitySealSaving}
        aria-label="Save Identity Seal"
        data-state={identitySealSaving ? "working" : "idle"}
        disabled={identitySealSaving || identityAuthenticating || !signingAvailable || !onSaveIdentitySeal}
        onClick={async () => {
          if (!onSaveIdentitySeal) return;
          if (!window.confirm("This Identity Seal stores this Receiz ID and full Wildz account continuity. Anyone who has it can authenticate this account. Save it now?")) return;
          setIdentitySealSaving(true);
          setIdentityMessage("Saving your full Receiz ID continuity seal…");
          try {
            await onSaveIdentitySeal();
            setIdentityMessage("Identity Seal saved with full account continuity.");
          } catch (cause) {
            const code = cause instanceof Error ? cause.message : "";
            setIdentityMessage(code === "wildz_identity_card_authority_required" || code === "wildz_identity_seal_authority_required"
              ? "Upload your Identity Seal first, then save the continuity seal again."
              : "Identity Seal could not be saved from this browser.");
          } finally {
            setIdentitySealSaving(false);
          }
        }}
        title="Save Identity Seal"
        type="button"
      ><Download aria-hidden="true" size={18} /></button>
      </> : null}
    </section>
    {editable ? <section className="wildz-profile-proof-actions" aria-label="Receiz identity controls">
      <input
        accept="image/png,image/jpeg,image/webp,application/json"
        className="wilds-import-input"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (!file || !onAuthenticateIdentitySeal) return;
          setIdentityAuthenticating(true);
          setIdentityMessage("Verifying Identity Seal or Record authority…");
          try {
            await onAuthenticateIdentitySeal(file);
            setIdentityMessage("Receiz ID activated. Your current Vault is still loaded.");
          } catch {
            setIdentityMessage("That file did not activate a Receiz ID. Choose the account's verified Identity Seal or Record.");
          } finally {
            setIdentityAuthenticating(false);
          }
        }}
        ref={identityInputRef}
        type="file"
      />
    </section> : null}
    <p className="wildz-profile-action-status" aria-live="polite" role="status">{identityMessage || shareResult?.message || (!shareEnabled ? "Publish this profile before sharing its link." : "")}</p>
    <div className="wildz-profile-stats"><span><b>{profile.discoveries}</b> discoveries</span><span><b>{profile.record.wins}</b> wins</span><span><b>{profile.reputation}</b> reputation</span></div>
    <section className="wildz-profile-impact" aria-label="Explorer impact">
      <span><small>World impact</small><strong>{profile.discoveries + profile.record.wins} admitted milestones</strong></span>
      <p>{profile.reputation > 0 ? `Your choices carry ${profile.reputation} reputation into future encounters.` : "Explore, battle, and help the living world to build a remembered reputation."}</p>
    </section>
    {profile.explorer ? <p className="wildz-profile-traits">{profile.explorer.traits.outfit.replaceAll("-", " ")} · {profile.explorer.traits.trail.replaceAll("-", " ")} trail</p> : null}
    <WildzVaultSheet cards={profile.vault} />
  </div>;
}
