export const CLAIM_MISMATCH_MESSAGE =
  "this allocation belongs to a different X account";

export class ClaimGateError extends Error {
  /** Server-side only. The claimant always sees CLAIM_MISMATCH_MESSAGE. */
  readonly detail: string;
  constructor(detail = "claim gate rejected the request") {
    super(CLAIM_MISMATCH_MESSAGE);
    this.name = "ClaimGateError";
    this.detail = detail;
  }
}

export function decodeOidcSubject(oidcToken: string): string {
  const payload = oidcToken.split(".")[1];
  if (!payload) throw new ClaimGateError("OIDC token is not a three-part JWT");
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
      throw new ClaimGateError("OIDC token payload has no string 'sub' claim");
    }
    return claims.sub;
  } catch (e) {
    if (e instanceof ClaimGateError) throw e;
    throw new ClaimGateError("OIDC token payload is not decodable JSON");
  }
}

/**
 * Turnkey returns the bare numeric X user ID as the OIDC subject. Verified against a
 * live OAuth2Authenticate response: sub="1270562298", not "x:1270562298". The prefixed
 * form is still accepted so the gate keeps working if Turnkey ever namespaces it.
 *
 * Only ever call this on a token Turnkey issued. A bare number carries no issuer of its
 * own, so it is the OAuth2Authenticate call — bound to the X credential ID — that makes
 * this an X identity rather than an arbitrary integer.
 */
const X_SUBJECT = /^(?:x:)?([1-9][0-9]*)$/;

export function numericXIdFromSubject(subject: string): string {
  const match = X_SUBJECT.exec(subject);
  if (!match) throw new ClaimGateError(`OIDC subject is not a numeric X ID: ${JSON.stringify(subject)}`);
  return match[1]!;
}

export function expectedXIdFromAllocationName(name: string): string {
  const match = /(?:^|:)claim:x:([1-9][0-9]*)(?:$|:)/.exec(name);
  if (!match) throw new ClaimGateError(`allocation name carries no claim:x:<id>: ${JSON.stringify(name)}`);
  return match[1]!;
}

export function assertClaimMatches(
  oidcToken: string,
  allocationName: string,
): string {
  const actual = numericXIdFromSubject(decodeOidcSubject(oidcToken));
  const expected = expectedXIdFromAllocationName(allocationName);
  if (actual !== expected)
    throw new ClaimGateError(`X ID mismatch: token ${actual} vs allocation ${expected}`);
  return actual;
}
