export function buildReceizConnectEntryUrl(authorizeUrl: string) {
  let authorize: URL;

  try {
    authorize = new URL(authorizeUrl);
  } catch {
    throw new Error("Receiz Connect requires an absolute Receiz authorize URL.");
  }

  if (!authorize.protocol.startsWith("http")) {
    throw new Error("Receiz Connect requires an absolute Receiz authorize URL.");
  }

  const signIn = new URL("/signin", authorize.origin);
  signIn.searchParams.set("next", authorize.toString());
  signIn.searchParams.set("lane", "connect");

  return signIn.toString();
}
