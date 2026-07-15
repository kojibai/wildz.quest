import { createReceizCommerceAdapter } from "./adapter";

export type ReceizConnectProfile = {
  customDomain: string;
  email: string;
  handle: string;
  id: string;
  imageUrl: string;
  name: string;
  subdomain: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function nestedRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return {};
}

function normalizeHandle(value: string) {
  const handle = value.trim().replace(/^@/, "");
  if (!handle) return "";
  return handle.includes(".") ? handle : `${handle}.receiz.id`;
}

export function profileFromReceizUserinfo(value: unknown): ReceizConnectProfile {
  const userinfo = asRecord(value);
  const appProfile = nestedRecord(userinfo, ["receiz_app", "commerce", "store", "app_metadata", "profile"]);
  const profileSource = { ...userinfo, ...appProfile };
  const handle = normalizeHandle(
    stringField(profileSource, ["receiz_id", "receizId", "preferred_username", "username", "handle"])
  );

  return {
    id: stringField(profileSource, ["sub", "user_id", "uid", "id"]),
    name: stringField(profileSource, ["name", "display_name", "displayName"]),
    email: stringField(profileSource, ["email"]),
    handle,
    imageUrl: stringField(profileSource, [
      "picture",
      "avatar_url",
      "avatarUrl",
      "image",
      "image_url",
      "logo",
      "logo_url",
      "profile_image_url",
      "profileImageUrl",
      "receiz_profile_image",
      "accountImageUrl"
    ]),
    subdomain: stringField(profileSource, ["receiz_app_subdomain", "store_subdomain", "subdomain", "tenantSlug"]),
    customDomain: stringField(profileSource, ["receiz_app_custom_domain", "store_custom_domain", "customDomain", "custom_domain", "domain"])
  };
}

export async function loadReceizConnectProfile(accessToken: string | undefined) {
  if (!accessToken) return null;

  const receiz = createReceizCommerceAdapter({
    baseUrl: process.env.RECEIZ_BASE_URL,
    accessToken
  });

  return profileFromReceizUserinfo(await receiz.userinfo());
}
