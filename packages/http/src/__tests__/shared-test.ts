import { describe, expect, it } from "@jest/globals";

import { getSignedTransactionFromActivity } from "../shared";
import type { TActivity } from "../shared";

function activity(result: unknown): TActivity {
  return {
    id: "activity-id",
    status: "ACTIVITY_STATUS_COMPLETED",
    type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
    result,
  } as unknown as TActivity;
}

describe("getSignedTransactionFromActivity", () => {
  it("returns the 0x-prefixed signed transaction", () => {
    const signed = getSignedTransactionFromActivity(
      activity({ signTransactionResult: { signedTransaction: "abcdef" } }),
    );

    expect(signed).toBe("0xabcdef");
  });

  it("throws when the activity carries no signed transaction", () => {
    expect(() =>
      getSignedTransactionFromActivity(activity({ signTransactionResult: {} })),
    ).toThrow();
  });
});
