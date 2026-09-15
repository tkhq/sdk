import assert from "node:assert/strict";
import { assertClaimMatches, ClaimGateError, CLAIM_MISMATCH_MESSAGE } from "../src/lib/claim-gate";

function token(subject: string): string {
  const payload = Buffer.from(JSON.stringify({ sub: subject })).toString("base64url");
  return `header.${payload}.signature`;
}

// The format Turnkey actually returns: a bare numeric X user ID.
assert.equal(assertClaimMatches(token("16088008"), "allocation:claim:x:16088008:@turnkey"), "16088008");
// The prefixed form is tolerated too, in case Turnkey ever namespaces the subject.
assert.equal(assertClaimMatches(token("x:16088008"), "allocation:claim:x:16088008:@turnkey"), "16088008");
// A different account is refused whichever form it arrives in.
assert.throws(
  () => assertClaimMatches(token("1270562298"), "allocation:claim:x:16088008:@turnkey"),
  ClaimGateError,
);
assert.throws(
  () => assertClaimMatches(token("x:999"), "allocation:claim:x:16088008:@turnkey"),
  (error: unknown) => error instanceof ClaimGateError && error.message === CLAIM_MISMATCH_MESSAGE,
);
assert.throws(() => assertClaimMatches(token("@mutable_handle"), "allocation:claim:x:16088008"), ClaimGateError);
console.log("PASS: forged OIDC sub cannot cross the numeric-X-ID claim gate");
