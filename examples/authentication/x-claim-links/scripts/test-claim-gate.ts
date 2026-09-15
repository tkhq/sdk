import assert from "node:assert/strict";
import { assertClaimMatches, ClaimGateError, CLAIM_MISMATCH_MESSAGE } from "../src/lib/claim-gate";

function token(subject: string): string {
  const payload = Buffer.from(JSON.stringify({ sub: subject })).toString("base64url");
  return `header.${payload}.signature`;
}

assert.equal(assertClaimMatches(token("x:2244994945"), "allocation:claim:x:2244994945:@turnkey"), "2244994945");
assert.throws(
  () => assertClaimMatches(token("x:999"), "allocation:claim:x:2244994945:@turnkey"),
  (error: unknown) => error instanceof ClaimGateError && error.message === CLAIM_MISMATCH_MESSAGE,
);
assert.throws(() => assertClaimMatches(token("@mutable_handle"), "allocation:claim:x:2244994945"), ClaimGateError);
console.log("PASS: forged OIDC sub cannot cross the numeric-X-ID claim gate");
