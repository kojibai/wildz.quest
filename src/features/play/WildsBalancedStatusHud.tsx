"use client";

import type { CSSProperties } from "react";
import { Icons } from "@/components/icons";
import type { KaiKlokMoment } from "./kai-klok-moment";
import type { WildsAudioSettings as WildsAudioSettingsValue } from "./wilds-audio";
import { WildsAudioSettings } from "./WildsAudioSettings";
import { WildsLivingWorldHud } from "./WildsLivingWorldHud";
import { WildsMultiplayer } from "./WildsMultiplayer";
import { WildsMessenger } from "./WildsMessenger";
import type { WildsMessengerController } from "./use-wilds-messenger";
import type { useWildsWorld } from "./use-wilds-world";
import type { WildsMultiplayerController } from "./use-wilds-multiplayer";
import { WildsWalletInstrument } from "./wallet/WildsWalletInstrument";
import type { WildsWalletPresentationState } from "./wallet/wilds-wallet-controller";

export function WildsBalancedStatusHud({
  audio,
  battleModalOwned,
  blocked,
  connected,
  dismissSignal,
  interactionEnabled,
  kaiMoment,
  modalOwned,
  multiplayer,
  messenger,
  onEnterRaid,
  onOpenCommandCenter,
  onOpenWallet,
  onSendPhi,
  onRosterOpenChange,
  player,
  wallet,
  walletEnabled,
  world
}: {
  audio: {
    onChange: (settings: WildsAudioSettingsValue) => void;
    onUnlock: () => void;
    ready: boolean;
    settings: WildsAudioSettingsValue;
  };
  battleModalOwned: boolean;
  blocked: boolean;
  connected: boolean;
  dismissSignal: number;
  interactionEnabled: boolean;
  kaiMoment: KaiKlokMoment;
  modalOwned: boolean;
  multiplayer: WildsMultiplayerController;
  messenger: WildsMessengerController;
  onEnterRaid: (bossId: string) => void;
  onOpenCommandCenter: () => void;
  onOpenWallet: (origin: HTMLButtonElement) => void;
  onSendPhi: (peer: { id: string; handle: string }) => void;
  onRosterOpenChange?: (open: boolean) => void;
  player: { x: number; z: number };
  wallet: WildsWalletPresentationState;
  walletEnabled: boolean;
  world: ReturnType<typeof useWildsWorld>;
}) {
  const homeInteractionEnabled = interactionEnabled && !blocked;
  return <>
    <div aria-hidden={blocked} className="wilds-map-status-home" inert={blocked ? true : undefined}>
      {blocked ? null : <WildsLivingWorldHud connected={connected} onEnterRaid={onEnterRaid} player={player} world={world} />}
      <WildsMultiplayer
        battleModalOwned={battleModalOwned}
        dismissSignal={dismissSignal}
        interactionEnabled={homeInteractionEnabled}
        modalOwned={modalOwned}
        multiplayer={multiplayer}
        messenger={messenger}
        onRosterOpenChange={onRosterOpenChange}
        position={player}
      />
    </div>
    <div aria-hidden={blocked} className="wilds-left-instrument-home" inert={blocked ? true : undefined}>
      <>
        <button
          aria-label={`Open living Command Center. Beat step pulse ${kaiMoment.latticeCoordinate}`}
          className="wilds-kai-command-pill"
          disabled={!interactionEnabled}
          onClick={() => {
            if (!interactionEnabled) return;
            onOpenCommandCenter();
          }}
          style={{ "--kai-accent": kaiMoment.accent } as CSSProperties}
          title="Open living Command Center"
          type="button"
        >
          <small>BEAT:STEP:PULSE</small>
          <span>{kaiMoment.latticeCoordinate}</span>
        </button>
        <WildsAudioSettings
          onChange={audio.onChange}
          onUnlock={audio.onUnlock}
          ready={audio.ready}
          settings={audio.settings}
        />
        {walletEnabled ? <WildsWalletInstrument disabled={!interactionEnabled} onOpen={onOpenWallet} state={wallet} /> : null}
        <button
          aria-label={`Open messages${messenger.unreadCount ? ` · ${messenger.unreadCount} unread` : ""}`}
          className={`wilds-message-instrument${messenger.unreadCount ? " has-unread" : ""}`}
          disabled={!interactionEnabled}
          onClick={() => {
            if (!interactionEnabled) return;
            multiplayer.selectPlayer(null);
            messenger.openMessenger();
          }}
          type="button"
        >
          <Icons.send size={17} />
          {messenger.unreadCount ? <b>{messenger.unreadCount > 99 ? "99+" : messenger.unreadCount}</b> : null}
        </button>
      </>
    </div>
    <WildsMessenger
      messenger={messenger}
      onSendPhi={onSendPhi}
      roomChat={{
        messages: multiplayer.snapshot?.messages ?? [],
        onSend: multiplayer.sendMessage
      }}
      selfId={multiplayer.selfId}
    />
  </>;
}
