import { ethers } from "ethers";
import { test, expect } from "@jest/globals";
import { TurnkeySigner, TurnkeyActivityError } from "../";

test("TurnkeySigner", async () => {
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
  const expectedEthAddress = assertNonEmptyString(
    process.env.EXPECTED_ETH_ADDRESS,
    `process.env.EXPECTED_ETH_ADDRESS`
  );
  const bannedToAddress = assertNonEmptyString(
    process.env.BANNED_TO_ADDRESS,
    `process.env.BANNED_TO_ADDRESS`
  );

  const provider = new ethers.providers.InfuraProvider("goerli");

  const signer = new TurnkeySigner({
    apiPublicKey,
    apiPrivateKey,
    baseUrl,
    organizationId,
    privateKeyId,
  }).connect(provider);

  expect(ethers.Signer.isSigner(signer)).toBe(true);

  expect(await signer.getAddress()).toBe(expectedEthAddress);

  const chainId = (await provider.getNetwork()).chainId;

  const tx = await signer.signTransaction({
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

  try {
    await signer.signTransaction({
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
});

function assertNonEmptyString(input: unknown, name: string): string {
  if (typeof input !== "string" || !input) {
    throw new Error(`Expected non empty string for "${name}", got ${input}`);
  }

  return input;
}
