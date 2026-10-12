type NativeApplicationEnvironment = Readonly<{
  RECEIZ_APPLICATION_ID?: string;
  RECEIZ_CLIENT_ID?: string;
}>;

/** Share Wallet's public registered client. The older application setting is
 * a compatibility fallback when Connect is not configured, never an override.
 * No username, private secret or transformed client ID supplies this binding. */
export function resolveWildzNativeApplicationId(environment: NativeApplicationEnvironment): string {
  const applicationId = environment.RECEIZ_CLIENT_ID ?? environment.RECEIZ_APPLICATION_ID;
  if (!applicationId) throw Error("receiz_native_application_required");
  if (!/^(?:[a-z][a-z0-9.-]{0,127}|rc_[A-Za-z0-9_-]{24})$/.test(applicationId))
    throw Error("receiz_native_application_invalid");
  return applicationId;
}

/** Next publishes only this nonsecret registration ID into browser bundles.
 * The server resolves its current configuration again before every write. */
export function wildzNativeApplicationId(): string {
  return typeof window === "undefined"
    ? resolveWildzNativeApplicationId({
      RECEIZ_APPLICATION_ID: process.env.RECEIZ_APPLICATION_ID,
      RECEIZ_CLIENT_ID: process.env.RECEIZ_CLIENT_ID,
    })
    : resolveWildzNativeApplicationId({RECEIZ_APPLICATION_ID: process.env.NEXT_PUBLIC_RECEIZ_NATIVE_APPLICATION_ID});
}
