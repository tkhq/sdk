export const CLAIM_MISMATCH_MESSAGE =
  "this allocation belongs to a different X account";

export class ClaimGateError extends Error {
  constructor(message = CLAIM_MISMATCH_MESSAGE) {
    super(message);
    this.name = "ClaimGateError";
  }
}

export function decodeOidcSubject(oidcToken: string): string {
  const payload = oidcToken.split(".")[1];
  if (!payload) throw new ClaimGateError();
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      typeof claims !== "object" ||
      claims === null ||
      !("sub" in claims) ||
      typeof claims.sub !== "string"
    ) {
      throw new ClaimGateError();
    }
    return claims.sub;
  } catch {
    throw new ClaimGateError();
  }
}

export function numericXIdFromSubject(subject: string): string {
  const match = /^x:([1-9][0-9]*)$/.exec(subject);
  if (!match) throw new ClaimGateError();
  return match[1]!;
}

export function expectedXIdFromAllocationName(name: string): string {
  const match = /(?:^|:)claim:x:([1-9][0-9]*)(?:$|:)/.exec(name);
  if (!match) throw new ClaimGateError();
  return match[1];
}

export function assertClaimMatches(
  oidcToken: string,
  allocationName: string,
): string {
  const actual = numericXIdFromSubject(decodeOidcSubject(oidcToken));
  const expected = expectedXIdFromAllocationName(allocationName);
  if (actual !== expected) throw new ClaimGateError();
  return actual;
}
