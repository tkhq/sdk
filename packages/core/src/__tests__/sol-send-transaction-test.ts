import { describe, expect, it, jest } from "@jest/globals";

import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import { StamperType } from "../__types__";

function createClient() {
  const stamp = jest.fn(async () => ({
    stampHeaderName: "X-Stamp",
    stampHeaderValue: "stamp",
  }));
  const client = new TurnkeySDKClientBase({
    apiBaseUrl: "https://api.example.com",
    organizationId: "org-id",
    apiKeyStamper: { stamp },
    defaultStamperType: StamperType.ApiKey,
  });

  return { client, stamp };
}

describe("generated Solana send transaction wrappers", () => {
  it("keeps v1 on the shared endpoint with the v1 activity type", async () => {
    const { client, stamp } = createClient();

    const request = await client.stampSolSendTransaction({
      unsignedTransaction: "AA==",
      signWith: "signer-a",
      caip2: "solana:devnet",
    });

    expect(request?.url).toBe(
      "https://api.example.com/public/v1/submit/sol_send_transaction",
    );
    expect(JSON.parse(request!.body)).toEqual({
      parameters: {
        unsignedTransaction: "AA==",
        signWith: "signer-a",
        caip2: "solana:devnet",
      },
      organizationId: "org-id",
      timestampMs: expect.any(String),
      type: "ACTIVITY_TYPE_SOL_SEND_TRANSACTION",
    });
    expect(stamp).toHaveBeenCalledWith(request?.body);
  });

  it("sends ordered v2 signers to the same endpoint with the v2 activity type", async () => {
    const { client, stamp } = createClient();

    const request = await client.stampSolSendTransactionV2({
      unsignedTransaction: "00",
      signWiths: ["signer-a", "signer-b"],
      caip2: "solana:devnet",
      sponsor: true,
    });

    expect(request?.url).toBe(
      "https://api.example.com/public/v1/submit/sol_send_transaction",
    );
    expect(JSON.parse(request!.body)).toEqual({
      parameters: {
        unsignedTransaction: "00",
        signWiths: ["signer-a", "signer-b"],
        caip2: "solana:devnet",
        sponsor: true,
      },
      organizationId: "org-id",
      timestampMs: expect.any(String),
      type: "ACTIVITY_TYPE_SOL_SEND_TRANSACTION_V2",
    });
    expect(stamp).toHaveBeenCalledWith(request?.body);
  });
});
