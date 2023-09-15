import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import hre from "hardhat";
import { TurnkeyActivityError } from "@turnkey/http";
// import { prepareSendTransaction } from '@wagmi/core';
// import { toAccount } from 'viem/accounts'

import {
  type Account,
  type Chain,
  type Hex,
  custom,
  WalletClient,
  createWalletClient,
  http,
  // stringToHex,
  getContract,
  getContractAddress,
  parseEther,
  parseUnits,
  recoverMessageAddress,
  verifyTypedData,
} from "viem";
import { sepolia } from "viem/chains";
// import type { Chain } from "viem";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { createAccount } from "../";

import Test721 from "./contracts/artifacts/src/__tests__/contracts/source/Test721.sol/Test721.json";

import { expect, beforeEach, describe, test } from "@jest/globals";

// @ts-expect-error
const testCase: typeof test = (...argList) => {
  if (!process.env.BANNED_TO_ADDRESS) {
    // For now, this test requires certain environment variables to be injected (from Turnkey's internal environment)
    return test.skip(...argList);
  }

  return test(...argList);
};

describe("TurnkeyAccount", () => {
  let walletClient: WalletClient;
  let eip1193Client: WalletClient;
  let turnkeyAccount: Account;
  // let walletAddress: string;
  // let chainId: number;
  let chain: Chain | undefined;
  let expectedEthAddress: Hex;
  let bannedToAddress: Hex;

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
    ) as Hex;

    bannedToAddress = assertNonEmptyString(
      process.env.BANNED_TO_ADDRESS,
      `process.env.BANNED_TO_ADDRESS`
    ) as Hex;

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

    turnkeyAccount = await createAccount({
      client: turnkeyClient,
      organizationId,
      privateKeyId,
    });

    walletClient = createWalletClient({
      account: turnkeyAccount,
      chain: sepolia,
      transport: http(),
    });

    eip1193Client = createWalletClient({
      account: turnkeyAccount,
      chain: sepolia,
      // transport: custom(provider),
      transport: custom(hre.network.provider),
    });

    // [walletAddress] = await walletClient.getAddresses();
    // chainId = await walletClient.getChainId();
    chain = walletClient.chain;

    setBalance(expectedEthAddress, parseEther("999999"));
  });

  // testCase("basics for connected signer", async () => {
  //   expect(ethers.Signer.isSigner(connectedSigner)).toBe(true);
  //   expect(await connectedSigner.getAddress()).toBe(expectedEthAddress);
  // });

  testCase("it signs transactions", async () => {
    // const viemAccount = toAccount(walletClient);
    const request = await walletClient.prepareTransactionRequest({
      account: turnkeyAccount,
      chain,
      to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
      value: parseEther("1.0"),
    });
    const tx = await walletClient.signTransaction(request);

    expect(tx).toMatch(/^0x/);
  });

  testCase("it sends transactions", async () => {
    const txHash = await walletClient.sendTransaction({
      account: turnkeyAccount,
      to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
      value: parseEther("1.0"),
      chain,
      nonce: 0,
      gas: 21000n,
      maxFeePerGas: parseUnits("2", 9),
      maxPriorityFeePerGas: parseUnits("200", 9),
      type: "eip1559",
    });

    expect(txHash).toMatch(/^0x/);
  });

  testCase(
    "it throws when there's a deny policy on the transaction",
    async () => {
      try {
        await walletClient.signTransaction({
          account: turnkeyAccount,
          to: bannedToAddress,
          value: parseEther("1.0"),
          chain,
          nonce: 0,
          gas: 21000n,
          maxFeePerGas: parseUnits("2", 9),
          maxPriorityFeePerGas: parseUnits("200", 9),
          type: "eip1559",
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
    const signMessageSignature = await walletClient.signMessage({
      account: turnkeyAccount,
      message,
    });
    const recoveredAddress = await recoverMessageAddress({
      message,
      signature: signMessageSignature,
    });

    expect(signMessageSignature).toMatch(/^0x/);
    expect(recoveredAddress).toEqual(expectedEthAddress);
  });

  testCase("it signs typed data (EIP-712)", async () => {
    // Test typed data signing (EIP-712)
    // All properties on a domain are optional
    const domain = {
      name: "Ether Mail",
      version: "1",
      chainId: 1,
      verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
    } as const;

    // The named list of all type definitions
    const types = {
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" },
      ],
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person" },
        { name: "contents", type: "string" },
      ],
    } as const;

    const typedData = {
      account: turnkeyAccount,
      domain,
      types,
      primaryType: "Mail",
      message: {
        from: {
          name: "Cow",
          wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
        },
        to: {
          name: "Bob",
          wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
        },
        contents: "Hello, Bob!",
      },
    } as const;

    const signTypedDataSignature = await walletClient.signTypedData(typedData);

    expect(signTypedDataSignature).toMatch(/^0x/);
    expect(
      verifyTypedData({
        ...typedData,
        address: turnkeyAccount.address,
        signature: signTypedDataSignature,
      })
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
      // delete payload.params[0].gas;
      // In a real-world scenario you should also verify that `from` matches the wallet's address
      // delete payload.params[0].from;

      const tx = await eip1193Client.request(payload);
      // const tx = await eip1193.request(payload);
      expect(tx).toMatch(/^0x/);
    });
  });

  // Use `pnpm run compile:contracts` to update the ABI if needed
  testCase("ERC-721", async () => {
    const { abi, bytecode } = Test721;
    // const factory = new ethers.ContractFactory(abi, bytecode).connect(
    //   connectedSigner
    // );

    // Deploy
    const deployHash = await walletClient.deployContract({
      abi,
      chain,
      account: turnkeyAccount,
      bytecode: bytecode as Hex,
    });

    const contractAddress = getContractAddress({
      from: turnkeyAccount.address,
      nonce: 0n,
    });

    expect(deployHash).toMatch(/^0x/);
    expect(contractAddress).toMatch(/^0x/);

    // Create contract instance
    const contract = getContract({
      address: contractAddress,
      abi,
      walletClient,
    });

    // expect(contract.deployTransaction.from).toEqual(expectedEthAddress);
    //
    // Mint
    // const mintTx = await contract.safeMint(expectedEthAddress);

    if (contract == undefined) {
      return;
    }

    // Mint
    // @ts-expect-error
    const mintHash = await contract.write.mint([expectedEthAddress]);
    // await mintTx.wait();

    expect(mintHash).toMatch(/^0x/);
    // expect(from).toEqual(expectedEthAddress);
    // expect(to).toEqual(contract.address);

    // Approve
    // @ts-expect-error
    const approveHash = await contract.write.approve([
      "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
      0, // `tokenId` is `0` because we've only minted once
    ]);
    // await approveTx.wait();

    expect(approveHash).toMatch(/^0x/);
    // expect(approveTx.from).toEqual(expectedEthAddress);
    // expect(approveTx.to).toEqual(contract.address);
  });
});

// describe("createApiKeyAccount", () => {
//   let client: WalletClient;
//   let expectedEthAddress: string;

//   beforeEach(async () => {
//     const apiPublicKey = assertNonEmptyString(
//       process.env.API_PUBLIC_KEY,
//       `process.env.API_PUBLIC_KEY`
//     );
//     const apiPrivateKey = assertNonEmptyString(
//       process.env.API_PRIVATE_KEY,
//       `process.env.API_PRIVATE_KEY`
//     );
//     const baseUrl = assertNonEmptyString(
//       process.env.BASE_URL,
//       `process.env.BASE_URL`
//     );
//     const organizationId = assertNonEmptyString(
//       process.env.ORGANIZATION_ID,
//       `process.env.ORGANIZATION_ID`
//     );
//     const privateKeyId = assertNonEmptyString(
//       process.env.PRIVATE_KEY_ID,
//       `process.env.PRIVATE_KEY_ID`
//     );

//     expectedEthAddress = assertNonEmptyString(
//       process.env.EXPECTED_ETH_ADDRESS,
//       `process.env.EXPECTED_ETH_ADDRESS`
//     );

//     const turnkeyClient = new TurnkeyClient(
//       {
//         baseUrl,
//       },
//       new ApiKeyStamper({
//         apiPublicKey,
//         apiPrivateKey,
//       })
//     );

//     const turnkeyAccount = await createAccount({
//       client: turnkeyClient,
//       organizationId,
//       privateKeyId,
//     });

//     client = createWalletClient({
//       account: turnkeyAccount,
//       chain: sepolia,
//       transport: http(),
//     });
//   });

//   // Create a .env file with credentials and modify this to "test(" to run tests
//   // TODO: make this work on CI
//   test.skip("basics", async () => {
//     expect(client.account?.address).toEqual(expectedEthAddress);

//     const message = "rno was here";

//     const simpleMessageSignature = await client.signMessage({
//       message,
//       account: client.account!,
//     });
//     expect(simpleMessageSignature).toEqual(
//       "0x42ea50d0e54726f9ce0eabf2823381a89ee9131eb2095f431ced65087213a1b767c112bd892dd9221cd269364a9938bbe63c65eea4794abbb7b7d355eadeb9131c"
//     );

//     const rawMessageSignature = await client.signMessage({
//       message: { raw: stringToHex(message) },
//       account: client.account!,
//     });
//     expect(rawMessageSignature).toEqual(simpleMessageSignature);
//   });
// });

function assertNonEmptyString(input: unknown, name: string): string {
  if (typeof input !== "string" || !input) {
    throw new Error(`Expected non empty string for "${name}", got ${input}`);
  }

  return input;
}
