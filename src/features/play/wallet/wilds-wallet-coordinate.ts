export const WILDS_WALLET_COORDINATE_SCHEMA = "receiz.wildz.wallet.receive-coordinate.v1" as const;

export type WildsWalletReceiveCoordinate = Readonly<{
  schema: typeof WILDS_WALLET_COORDINATE_SCHEMA;
  recipientUsername: string;
  recipientLocator: string;
  amountPhiMicro?: string;
}>;

const USERNAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const LOCATOR = /^wildz:receive:v[12]\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MICRO_PHI = /^[1-9][0-9]{0,29}$/;

export function createWildsWalletReceiveCoordinate(input: Readonly<{
  recipientUsername: string;
  recipientLocator: string;
  amountPhiMicro?: string | null;
}>): WildsWalletReceiveCoordinate {
  const recipientUsername = input.recipientUsername.trim().replace(/^@/, "");
  if (!USERNAME.test(recipientUsername) || !LOCATOR.test(input.recipientLocator)) throw new Error("wilds_wallet_receive_coordinate_invalid");
  if (input.amountPhiMicro != null && !MICRO_PHI.test(input.amountPhiMicro)) throw new Error("wilds_wallet_receive_coordinate_invalid");
  return Object.freeze({
    schema: WILDS_WALLET_COORDINATE_SCHEMA,
    recipientUsername,
    recipientLocator: input.recipientLocator,
    ...(input.amountPhiMicro ? { amountPhiMicro: input.amountPhiMicro } : {})
  });
}

export function encodeWildsWalletReceiveCoordinate(coordinate: WildsWalletReceiveCoordinate) {
  return JSON.stringify(coordinate);
}

export function parseWildsWalletReceiveCoordinate(value: string): WildsWalletReceiveCoordinate {
  try {
    const item = JSON.parse(value) as Record<string, unknown>;
    const keys = Object.keys(item);
    if (item.schema !== WILDS_WALLET_COORDINATE_SCHEMA
      || typeof item.recipientUsername !== "string"
      || typeof item.recipientLocator !== "string"
      || (item.amountPhiMicro !== undefined && typeof item.amountPhiMicro !== "string")
      || keys.some((key) => !["schema", "recipientUsername", "recipientLocator", "amountPhiMicro"].includes(key))) {
      throw new Error("shape");
    }
    return createWildsWalletReceiveCoordinate({
      recipientUsername: item.recipientUsername,
      recipientLocator: item.recipientLocator,
      amountPhiMicro: item.amountPhiMicro as string | undefined
    });
  } catch {
    throw new Error("wilds_wallet_receive_coordinate_invalid");
  }
}
