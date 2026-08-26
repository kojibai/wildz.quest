"use client";

import jsQR from "jsqr";
import React, { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { parseWildsWalletReceiveCoordinate, type WildsWalletReceiveCoordinate } from "./wilds-wallet-coordinate";

function scanPixels(context: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = context.getImageData(0, 0, width, height);
  return jsQR(pixels.data, width, height, { inversionAttempts: "dontInvert" })?.data ?? null;
}

export function WildsWalletQrScanner({ onCancel, onScan }: { onCancel(): void; onScan(coordinate: WildsWalletReceiveCoordinate): void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("Starting the rear camera…");
  const settledRef = useRef(false);
  const accept = useCallback((value: string) => {
    if (settledRef.current) return;
    try { settledRef.current = true; onScan(parseWildsWalletReceiveCoordinate(value)); }
    catch { setStatus("That QR is not a valid Receiz receiving coordinate."); }
  }, [onScan]);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let active = true;
    const tick = () => {
      if (!active || settledRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        const scale = Math.min(1, 960 / video.videoWidth);
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const value = scanPixels(context, canvas.width, canvas.height);
          if (value) { accept(value); return; }
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    void navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async (value) => {
        if (!active) { value.getTracks().forEach((track) => track.stop()); return; }
        stream = value;
        if (videoRef.current) { videoRef.current.srcObject = value; await videoRef.current.play(); setStatus("Center the receiving QR inside the frame."); frame = window.requestAnimationFrame(tick); }
      })
      .catch(() => setStatus("Camera access is unavailable. Choose a saved QR image instead."));
    return () => { active = false; window.cancelAnimationFrame(frame); stream?.getTracks().forEach((track) => track.stop()); };
  }, [accept]);
  const scanImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      try {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !context) throw new Error("canvas");
        const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const value = scanPixels(context, canvas.width, canvas.height);
        if (value) accept(value); else setStatus("No readable receiving QR was found in that image.");
      } finally { URL.revokeObjectURL(url); event.target.value = ""; }
    };
    image.onerror = () => { URL.revokeObjectURL(url); setStatus("That image could not be opened."); };
    image.src = url;
  };
  return <div aria-label="Scan receiving coordinate" className="wilds-wallet-scanner" role="dialog">
    <div className="wilds-wallet-scanner-view"><video aria-hidden="true" muted playsInline ref={videoRef} /><span aria-hidden="true" /></div>
    <canvas hidden ref={canvasRef} />
    <p aria-live="polite" role="status">{status}</p>
    <div className="wilds-wallet-scanner-actions"><label>Choose QR image<input accept="image/*" capture="environment" onChange={scanImage} type="file" /></label><button onClick={onCancel} type="button">Cancel</button></div>
  </div>;
}
