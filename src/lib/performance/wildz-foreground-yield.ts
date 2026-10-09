/** Required startup admission releases input/rendering between short slices.
 * Waiting for an animation frame/idle slot per slice adds a display interval
 * to each history batch on mobile. A message task yields without that delay. */
export function yieldWildzForeground(): Promise<void> {
  return new Promise(resolve => {
    if (typeof MessageChannel !== "undefined") {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
      channel.port2.postMessage(null);
    } else setTimeout(resolve, 0);
  });
}
