import { Eip1193Bridge } from "@ethersproject/experimental";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "ethers";
import hre from "hardhat";
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
  let eip1193: Eip1193Bridge;

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

    // @ts-expect-error
    const provider = hre.ethers.provider;

    connectedSigner = new TurnkeySigner({
      apiPublicKey,
      apiPrivateKey,
      baseUrl,
      organizationId,
      privateKeyId,
    }).connect(provider);

    chainId = (await connectedSigner.provider!.getNetwork()).chainId;

    eip1193 = new Eip1193Bridge(connectedSigner, provider);

    setBalance(expectedEthAddress, ethers.utils.parseEther("999999"));
  });

  testCase("basics", async () => {
    expect(ethers.Signer.isSigner(connectedSigner)).toBe(true);
    expect(await connectedSigner.getAddress()).toBe(expectedEthAddress);
  });

  testCase("it signs transactions", async () => {
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

  testCase("it sends transactions", async () => {
    const tx = await connectedSigner.sendTransaction({
      to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
      value: ethers.utils.parseEther("2"),
      type: 2,
    });
    const receipt = await tx.wait();

    expect(receipt.status).toBe(1);
    expect(receipt.type).toBe(2);
    expect(receipt.from).toBe(expectedEthAddress);
    expect(receipt.transactionHash).toMatch(/^0x/);
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
            "cause": [TurnkeyRequestError: Turnkey error 2: unable to execute ruling: ump denied request explicitly (Details: [])],
            "message": "Failed to sign: Turnkey error 2: unable to execute ruling: ump denied request explicitly (Details: [])",
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

  describe("it signs walletconnect v1 payloads, bridged via EIP-1193", () => {
    // https://docs.walletconnect.com/1.0/json-rpc-api-methods/ethereum

    testCase("Uniswap payload", async () => {
      const payload: any = {
        id: 1683062025301507,
        jsonrpc: "2.0",
        method: "eth_sendTransaction",
        params: [
          {
            gas: "0x2fe08", // See comment below
            value: "0xf4240",
            from: "0x064c0cfdd7c485eba21988ded4dbcd9358556842", // See comment below
            to: "0x4648a43b2c14da09fdf82b161150d3f634f40491",
            data: "0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000006451840800000000000000000000000000000000000000000000000000000000000000020b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000677493600000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002bb4fbf271143f4fbf7b91a5ded31805e42b2208d6000bb81f9840a85d5af5bf1d1762f925bdaddc4201f984000000000000000000000000000000000000000000",
          },
        ],
      };

      // NOTE: you can't pass `gas` and `from` as-is to `Eip1193Bridge`
      // See https://github.com/ethers-io/ethers.js/issues/1683
      delete payload.params[0].gas;
      // In a real-world scenario you should also verify that `from` matches the wallet's address
      delete payload.params[0].from;

      const tx = await eip1193.request(payload);
      expect(tx).toMatch(/^0x/);
    });
  });
});

function assertNonEmptyString(input: unknown, name: string): string {
  if (typeof input !== "string" || !input) {
    throw new Error(`Expected non empty string for "${name}", got ${input}`);
  }

  return input;
}
