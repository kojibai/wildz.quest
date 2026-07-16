const expectedToken = process.env.RECEIZ_DOCTOR_TEST_TOKEN;

globalThis.fetch = async (input, init = {}) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  const authorized = expectedToken
    && request.headers.get("authorization") === `Bearer ${expectedToken}`;
  if (!authorized) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supported = new Set([
    "/api/oidc/userinfo",
    "/api/connect/wallet/me",
    "/api/connect/proof/query",
    "/api/world/public",
    "/api/connect/portability/store/export",
    "/api/connect/releases/check",
    "/api/connect/merchants/capabilities"
  ]);
  if (!supported.has(url.pathname)) {
    return Response.json({ ok: false, error: "unexpected_probe" }, { status: 404 });
  }

  if (url.pathname === "/api/oidc/userinfo") {
    return Response.json({ sub: "receiz-doctor-test-subject", handle: "@release_probe" });
  }
  if (url.pathname === "/api/connect/merchants/capabilities") {
    return Response.json({ ok: true, capabilities: { payments: { available: true } } });
  }
  return Response.json({ ok: true, events: [], records: [] });
};
