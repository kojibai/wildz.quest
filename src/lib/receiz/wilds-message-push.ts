import { createHash } from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import type { WildsDirectMessage, WildsMessengerParticipant } from "@/features/play/wilds-messenger-core";

// Redis holds delivery addresses and inbox discovery hints, never message authority.
// Accept integration-provisioned credentials so a connected Vercel/Upstash store
// works without manually duplicating its environment variables.
function messagePushRedisConfig() {
  return {
    url: process.env.WILDS_PUSH_REDIS_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.WILDS_PUSH_REDIS_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  };
}
export function messagePushConfigured() {
  const redis = messagePushRedisConfig();
  return Boolean(redis.url && redis.token
    && process.env.WILDS_PUSH_VAPID_PUBLIC_KEY && process.env.WILDS_PUSH_VAPID_PRIVATE_KEY
    && process.env.WILDS_PUSH_VAPID_SUBJECT);
}

export async function pushRedis(command: (string | number)[]) {
  const redis = messagePushRedisConfig();
  const response = await fetch(redis.url!, {
    method: "POST", headers: { authorization: `Bearer ${redis.token}`, "content-type": "application/json" },
    body: JSON.stringify(command), cache: "no-store", signal: AbortSignal.timeout(5000)
  });
  const data = await response.json() as { result?: unknown; error?: string };
  if (!response.ok || data.error) throw new Error("wilds_push_storage_unavailable");
  return data.result;
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const subscriptionsKey = (actorId: string) => `wildz:push:subscriptions:${digest(actorId)}`;
const peersKey = (actorId: string) => `wildz:push:peers:${digest(actorId)}`;
export const pushEndpointId = (endpoint: string) => digest(endpoint);

export function parseMessagePushSubscription(value: unknown): PushSubscription {
  const item = value as Partial<PushSubscription> | null;
  if (!item || typeof item.endpoint !== "string" || item.endpoint.length > 2048
    || typeof item.keys?.p256dh !== "string" || typeof item.keys?.auth !== "string") throw new Error("wilds_push_subscription_invalid");
  const url = new URL(item.endpoint);
  const allowed = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
  if (url.protocol !== "https:" || url.port || url.username || url.password
    || !(allowed.includes(url.hostname) || url.hostname.endsWith(".notify.windows.com"))) throw new Error("wilds_push_endpoint_invalid");
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(item.keys.p256dh) || Buffer.from(item.keys.p256dh, "base64url").length !== 65
    || !/^[A-Za-z0-9_-]+={0,2}$/.test(item.keys.auth) || Buffer.from(item.keys.auth, "base64url").length !== 16) throw new Error("wilds_push_keys_invalid");
  return { endpoint: item.endpoint, keys: { p256dh: item.keys.p256dh, auth: item.keys.auth } };
}

export async function saveMessagePushSubscription(actorId: string, subscription: PushSubscription) {
  // Reassign a device atomically when another player signs in on the same browser.
  const id = pushEndpointId(subscription.endpoint);
  await pushRedis(["EVAL", `local old = redis.call('GET', KEYS[1]); if old then redis.call('HDEL', old, ARGV[1]); end; redis.call('SET', KEYS[1], KEYS[2]); redis.call('HSET', KEYS[2], ARGV[1], ARGV[2]); return 1`,
    2, `wildz:push:owner:${id}`, subscriptionsKey(actorId), id, JSON.stringify(subscription)]);
}

export async function removeMessagePushSubscription(actorId: string, endpoint: string) {
  await pushRedis(["HDEL", subscriptionsKey(actorId), pushEndpointId(endpoint)]);
}

export async function messagePushPeers(actorId: string): Promise<WildsMessengerParticipant[]> {
  if (!messagePushConfigured()) return [];
  const rows = await pushRedis(["HVALS", peersKey(actorId)]) as string[];
  return rows.slice(0, 80).flatMap((row) => { try { return [JSON.parse(row) as WildsMessengerParticipant]; } catch { return []; } });
}

export async function deliverMessagePush(message: WildsDirectMessage) {
  if (!messagePushConfigured()) return;
  try {
    await pushRedis(["HSET", peersKey(message.recipientId), digest(message.senderId), JSON.stringify({ id: message.senderId, handle: message.senderHandle })]);
    const rows = await pushRedis(["HVALS", subscriptionsKey(message.recipientId)]) as string[];
    await Promise.allSettled(rows.map(async (row) => {
      const subscription = parseMessagePushSubscription(JSON.parse(row));
      const sentKey = `wildz:push:sent:${digest(`${message.id}:${subscription.endpoint}`)}`;
      if (await pushRedis(["GET", sentKey])) return;
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ type: "wildz-message", messageId: message.id,
          recipientId: message.recipientId, peer: { id: message.senderId, handle: message.senderHandle },
          title: `${message.senderHandle} messaged you`, body: "Open Wildz to read your message." }), {
          TTL: 86400, timeout: 5000,
          vapidDetails: { subject: process.env.WILDS_PUSH_VAPID_SUBJECT!, publicKey: process.env.WILDS_PUSH_VAPID_PUBLIC_KEY!, privateKey: process.env.WILDS_PUSH_VAPID_PRIVATE_KEY! }
        });
        await pushRedis(["SET", sentKey, "1", "EX", 604800]);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await removeMessagePushSubscription(message.recipientId, subscription.endpoint);
      }
    }));
  } catch {
    // Delivery is advisory: a push provider outage must not fail an admitted send.
  }
}
