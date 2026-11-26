/** v129.5.0 compares a newly issued session with a pre-request clock sample.
 * The SDK rechecks the response on the exact same signed request. Receiz
 * recovers the persisted issue for that challenge instead of creating another. */
export async function reopenWildsIssuedAuthoritySession<Input, Session>(
  runtime: { openAuthoritySessionV124(input: Input): Promise<Session> },
  request: Input,
): Promise<Session> {
  try {
    return await runtime.openAuthoritySessionV124(request);
  } catch (cause) {
    if (!(cause instanceof Error) || cause.message !== "V124_AUTHORITY_SESSION_NOT_YET_ACTIVE") throw cause;
    return runtime.openAuthoritySessionV124(request);
  }
}
