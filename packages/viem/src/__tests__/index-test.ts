import { WalletClient, createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";

import { createApiKeyAccount } from "../";

import { expect, beforeEach, describe, test } from "@jest/globals";

describe("createApiKeyAccount", () => {
  let client: WalletClient;
  let expectedEthAddress: string;

  beforeEach(async () => {
    const apiPublicKey = assertNonEmptyString(
      process.env.API_PUBLIC_KEY,
      `process.env.API_PUBLIC_KEY`
    );
    const apiPrivateKey = assertNonEmptyString(
      process.env.API_PRIVATE_KEY,
      `process.env.API_PRIVATE_KEY`
    );
    const baseUrl = assertNonEmptyString(
      process.env.BASE_URL,
      `process.env.BASE_URL`
    );
    const organizationId = assertNonEmptyString(
      process.env.ORGANIZATION_ID,
      `process.env.ORGANIZATION_ID`
    );
    const privateKeyId = assertNonEmptyString(
      process.env.PRIVATE_KEY_ID,
      `process.env.PRIVATE_KEY_ID`
    );

    expectedEthAddress = assertNonEmptyString(
      process.env.EXPECTED_ETH_ADDRESS,
      `process.env.EXPECTED_ETH_ADDRESS`
    );

    const turnkeyAccount = await createApiKeyAccount({
      apiPublicKey,
      apiPrivateKey,
      baseUrl,
      organizationId,
      privateKeyId,
    });

    client = createWalletClient({
      account: turnkeyAccount,
      chain: sepolia,
      transport: http(),
    });
  });

  // Create a .env file with credentials and modify this to "test(" to run tests
  // TODO: make this work on CI
  test.skip("basics", async () => {
    expect(client.account?.address).toEqual(expectedEthAddress);

    const signature = await client.signMessage({
      message: "rno was here",
      account: client.account!,
    });
    expect(signature).toEqual(
      "0x42ea50d0e54726f9ce0eabf2823381a89ee9131eb2095f431ced65087213a1b767c112bd892dd9221cd269364a9938bbe63c65eea4794abbb7b7d355eadeb9131c"
    );
  });
});

function assertNonEmptyString(input: unknown, name: string): string {
  if (typeof input !== "string" || !input) {
    throw new Error(`Expected non empty string for "${name}", got ${input}`);
  }

  return input;
}
