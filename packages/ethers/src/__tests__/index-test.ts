import { ethers } from "ethers";
import { test, expect, beforeEach, describe } from "@jest/globals";
import { TurnkeySigner, TurnkeyActivityError } from "../";

// @ts-expect-error
const testCase: typeof test = (...argList) => {
  if (!process.env.BANNED_TO_ADDRESS) {
    // For now, this test requires certain environment variables to be injected (from Turnkey's internal environment)
    return test.skip(...argList);
  }

  return test(...argList);
};

describe("TurnkeySigner", () => {
  let connectedSigner: TurnkeySigner;
  let chainId: number;
  let expectedEthAddress: string;
  let bannedToAddress: string;

  beforeEach(async () => {
    if (!process.env.BANNED_TO_ADDRESS) {
      // For now, this test requires certain environment variables to be injected (from Turnkey's internal environment)
      return;
    }

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

    bannedToAddress = assertNonEmptyString(
      process.env.BANNED_TO_ADDRESS,
      `process.env.BANNED_TO_ADDRESS`
    );

    const provider = new ethers.providers.InfuraProvider("goerli");

    connectedSigner = new TurnkeySigner({
      apiPublicKey,
      apiPrivateKey,
      baseUrl,
      organizationId,
      privateKeyId,
    }).connect(provider);

    chainId = (await connectedSigner.provider!.getNetwork()).chainId;
  });

  testCase("it signs transactions", async () => {
    expect(ethers.Signer.isSigner(connectedSigner)).toBe(true);
    expect(await connectedSigner.getAddress()).toBe(expectedEthAddress);

    const tx = await connectedSigner.signTransaction({
      to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
      value: ethers.utils.parseEther("1.0"),
      chainId,
      nonce: 0,
      gasLimit: 21000,
      maxFeePerGas: 2e9,
      maxPriorityFeePerGas: 200e9,
      type: 2,
    });

    expect(tx).toMatch(/^0x/);
  });

  testCase(
    "it throws when there's a deny policy on the transaction",
    async () => {
      try {
        await connectedSigner.signTransaction({
          to: bannedToAddress,
          value: ethers.utils.parseEther("1.0"),
          chainId,
          nonce: 0,
          gasLimit: 21000,
          maxFeePerGas: 2e9,
          maxPriorityFeePerGas: 200e9,
          type: 2,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TurnkeyActivityError);

        const { message, cause, activityId, activityStatus, activityType } =
          error as TurnkeyActivityError;

        // We don't have activity info here, because signer returns an http error
        expect({
          message,
          cause,
          activityId,
          activityStatus,
          activityType,
        }).toMatchInlineSnapshot(`
        {
          "activityId": null,
          "activityStatus": null,
          "activityType": null,
          "cause": [Error: 500: Internal Server Error | Internal error 2: unable to execute ruling: ump denied request explicitly],
          "message": "Failed to sign",
        }
      `);
      }
    }
  );

  testCase("it signs messages, `eth_sign` style", async () => {
    // Test message (raw payload) signing, `eth_sign` style
    const message = "Hello Turnkey";
    const signMessageSignature = await connectedSigner.signMessage(message);

    expect(signMessageSignature).toMatch(/^0x/);
    expect(ethers.utils.verifyMessage(message, signMessageSignature)).toEqual(
      expectedEthAddress
    );
  });

  testCase("it signs typed data (EIP-712)", async () => {
    // Test typed data signing (EIP-712)
    const typedData = {
      types: {
        // Note that we do not need to include `EIP712Domain` as a type here, as Ethers will automatically inject it for us
        Person: [
          { name: "name", type: "string" },
          { name: "wallet", type: "address" },
        ],
      },
      domain: {
        name: "EIP712 Test",
        version: "1",
      },
      primaryType: "Person",
      message: {
        name: "Alice",
        wallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      },
    };

    const signTypedDataSignature = await connectedSigner.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    );

    expect(signTypedDataSignature).toMatch(/^0x/);
    expect(
      ethers.utils.verifyTypedData(
        typedData.domain,
        typedData.types,
        typedData.message,
        signTypedDataSignature
      )
    ).toEqual(expectedEthAddress);
  });
});

function assertNonEmptyString(input: unknown, name: string): string {
  if (typeof input !== "string" || !input) {
    throw new Error(`Expected non empty string for "${name}", got ${input}`);
  }

  return input;
}
