export function shouldShowIncomingChallenge<T>(
  interactionEnabled: boolean,
  incomingChallenge: T | null | undefined
): incomingChallenge is T {
  return interactionEnabled && Boolean(incomingChallenge);
}

export async function dismissIncomingChallengeWhenBlocked(
  interactionEnabled: boolean,
  challengeId: string | null | undefined,
  answerChallenge: (challengeId: string, action: "accept" | "decline") => Promise<unknown>
) {
  if (interactionEnabled || !challengeId) return false;
  await answerChallenge(challengeId, "decline");
  return true;
}

export async function shareWildzInviteWhenEnabled<Result>(
  interactionEnabled: boolean,
  createInviteLink: () => Promise<string>,
  shareInvite: (url: string) => Promise<Result>
): Promise<Result | null> {
  if (!interactionEnabled) return null;
  const url = await createInviteLink();
  return shareInvite(url);
}
