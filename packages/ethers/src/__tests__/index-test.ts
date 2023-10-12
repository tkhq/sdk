import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "ethers";
import hre from "hardhat";
import { test, expect, beforeEach, describe } from "@jest/globals";
import { TurnkeySigner, TurnkeyActivityError } from "../";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { Test721__factory as Test721Factory } from "./Test721Factory";

// @ts-expect-error
const testCase: typeof test = (...argList) => {
  if (!process.env.BANNED_TO_ADDRESS) {
    // For now, this test requires certain environment variables to be injected (from Turnkey's internal environment, or a local `.env` file)
    return test.skip(...argList);
  }

  return test(...argList);
};

describe("TurnkeySigner", () => {
  let connectedSigner: TurnkeySigner;
  let signerWithProvider: TurnkeySigner;
  let chainId: bigint;
  let expectedEthAddress: string;
  let bannedToAddress: string;
  let eip1193Provider: ethers.Provider;

  beforeEach(async () => {
    if (!process.env.BANNED_TO_ADDRESS) {
      // For now, this test requires certain environment variables to be injected (from Turnkey's internal environment, or a local `.env` file)
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

    // @ts-ignore
    const provider = hre.ethers.provider;

    // create new client
    const turnkeyClient = new TurnkeyClient(
      {
        baseUrl,
      },
      new ApiKeyStamper({
        apiPublicKey,
        apiPrivateKey,
      })
    );

    connectedSigner = new TurnkeySigner({
      client: turnkeyClient,
      organizationId,
      privateKeyId,
    }).connect(provider);

    signerWithProvider = new TurnkeySigner(
      {
        client: turnkeyClient,
        organizationId,
        privateKeyId,
      },
      provider
    );

    chainId = (await connectedSigner.provider!.getNetwork()).chainId;

    // need a node-compatible (read: non-`window.ethereum`) Eip1193Provider
    eip1193Provider = new ethers.BrowserProvider(provider);

    setBalance(expectedEthAddress, ethers.parseEther("999999"));
  });

  testCase("basics for connected signer", async () => {
    expect(connectedSigner.signMessage).toBeTruthy();
    expect(await connectedSigner.getAddress()).toBe(expectedEthAddress);
  });
  
  testCase("basics for connected signer via constructor", async () => {
    expect(signerWithProvider.signMessage).toBeTruthy();
    expect(await signerWithProvider.getAddress()).toBe(expectedEthAddress);
  });

  testCase("it signs transactions", async () => {
    const tx = await connectedSigner.signTransaction({
      to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
      value: ethers.parseEther("1.0"),
      chainId,
      nonce: 0,
      gasLimit: 21000,
      maxFeePerGas: 2e9,
      maxPriorityFeePerGas: 200e9,
      type: 2,
    });

    expect(tx).toMatch(/^0x/);
  });

  testCase("it allows (and drops) `tx.from`", async () => {
    const goodTx = await connectedSigner.signTransaction({
      from: expectedEthAddress,
      to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
      value: ethers.parseEther("1.0"),
      chainId,
      nonce: 0,
      gasLimit: 21000,
      maxFeePerGas: 2e9,
      maxPriorityFeePerGas: 200e9,
      type: 2,
    });

    expect(goodTx).toMatch(/^0x/);

    const badFromAddress = "0x0654B42A1b126377b6eaBb524e9348d495cAC1ba";

    try {
      await connectedSigner.signTransaction({
        from: badFromAddress,
        to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
        value: ethers.parseEther("1.0"),
        chainId,
        nonce: 0,
        gasLimit: 21000,
        maxFeePerGas: 2e9,
        maxPriorityFeePerGas: 200e9,
        type: 2,
      });

      expect("this-should-never-be").toBe("reached");
    } catch (error) {
      expect((error as any as Error).message).toBe(
        `Transaction \`tx.from\` address mismatch. Self address: ${expectedEthAddress}; \`tx.from\` address: ${badFromAddress}`
      );
    }
  });

  testCase("it sends transactions", async () => {
    const tx = await connectedSigner.sendTransaction({
      to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
      value: ethers.parseEther("2"),
      type: 2,
    });
    const receipt = await tx.wait();

    expect(receipt!.status).toBe(1);
    expect(receipt!.type).toBe(2);
    expect(receipt!.from).toBe(expectedEthAddress);
    expect(receipt!.hash).toMatch(/^0x/);
  });

  testCase(
    "it throws when there's a deny policy on the transaction",
    async () => {
      try {
        await connectedSigner.signTransaction({
          to: bannedToAddress,
          value: ethers.parseEther("1.0"),
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
            "cause": [TurnkeyRequestError: Turnkey error 7: policy engine denied request explicitly (Details: [])],
            "message": "Failed to sign: Turnkey error 7: policy engine denied request explicitly (Details: [])",
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
    expect(ethers.verifyMessage(message, signMessageSignature)).toEqual(
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
      ethers.verifyTypedData(
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

      const tx = await eip1193Provider.request(payload);
      expect(tx).toMatch(/^0x/);
    });
  });

  // Use `pnpm run compile:contracts` to update the ABI if needed
  testCase("ERC-721", async () => {
    // Deploy contract
    const contract = await new Test721Factory(connectedSigner).deploy();

    const deploymentAddress = await contract.getAddress();
    const deploymentTransaction = await contract.deploymentTransaction();

    expect(deploymentAddress).toMatch(/^0x/);
    expect(deploymentTransaction!.from).toEqual(expectedEthAddress);

    // Mint
    const mintTx = await contract.safeMint(expectedEthAddress);
    await mintTx.wait();

    expect(mintTx.hash).toMatch(/^0x/);
    expect(mintTx.from).toEqual(expectedEthAddress);
    expect(mintTx.to).toEqual(deploymentAddress);

    // Approve
    const approveTx = await contract.approve(
      "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
      0 // `tokenId` is `0` because we've only minted once
    );
    await approveTx.wait();

    expect(approveTx.hash).toMatch(/^0x/);
    expect(approveTx.from).toEqual(expectedEthAddress);
    expect(approveTx.to).toEqual(deploymentAddress);
  });
});

function assertNonEmptyString(input: unknown, name: string): string {
  if (typeof input !== "string" || !input) {
    throw new Error(`Expected non empty string for "${name}", got ${input}`);
  }

  return input;
}
