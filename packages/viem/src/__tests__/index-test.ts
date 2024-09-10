import { TurnkeyActivityError } from "@turnkey/http";
import {
  type LocalAccount,
  type Chain,
  type Hex,
  createTestClient,
  publicActions,
  walletActions,
  http,
  stringToHex,
  getContract,
  getContractAddress,
  parseEther,
  parseUnits,
} from "viem";
import { foundry } from "viem/chains";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { createAccount, createAccountWithAddress } from "../";
import Test721 from "./Test721.json";
import { expect, beforeEach, describe, test } from "@jest/globals";

import fetch from "cross-fetch";
globalThis.fetch = fetch;

// @ts-expect-error
const testCase: typeof test = (...argList) => {
  if (!process.env.BANNED_TO_ADDRESS) {
    // For now, this test requires certain environment variables to be injected (from either Turnkey's internal environment, or a local `.env` file)
    return test.skip(...argList);
  }

  return test(...argList);
};

describe("TurnkeyAccount", () => {
  let walletClient: any;
  let turnkeyAccount: LocalAccount;
  let chain: Chain | undefined;

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
  const expectedPrivateKeyEthAddress = assertNonEmptyString(
    process.env.EXPECTED_PRIVATE_KEY_ETH_ADDRESS,
    `process.env.EXPECTED_PRIVATE_KEY_ETH_ADDRESS`
  ) as Hex;
  const expectedWalletAccountEthAddress = assertNonEmptyString(
    process.env.EXPECTED_WALLET_ACCOUNT_ETH_ADDRESS,
    `process.env.EXPECTED_WALLET_ACCOUNT_ETH_ADDRESS`
  ) as Hex;
  const bannedToAddress = assertNonEmptyString(
    process.env.BANNED_TO_ADDRESS,
    `process.env.BANNED_TO_ADDRESS`
  ) as Hex;

  [
    {
      configName: "Wallet Account",
      signWith: expectedWalletAccountEthAddress,
      expectedEthAddress: expectedWalletAccountEthAddress,
    },
    {
      configName: "Wallet Account using createAccountWithAddress",
      signWith: expectedWalletAccountEthAddress,
      expectedEthAddress: expectedWalletAccountEthAddress,
    },
    {
      configName: "Private Key ID",
      signWith: privateKeyId,
      expectedEthAddress: expectedPrivateKeyEthAddress,
    },
    {
      configName: "Private Key Address",
      signWith: expectedPrivateKeyEthAddress,
      expectedEthAddress: expectedPrivateKeyEthAddress,
    },
    {
      configName: "Private Key Address using createAccountWithAddress",
      signWith: expectedPrivateKeyEthAddress,
      expectedEthAddress: expectedPrivateKeyEthAddress,
    },
  ].forEach(async (signingConfig) => {
    describe(`using config ${signingConfig.configName}`, () => {
      beforeEach(async () => {
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

        turnkeyAccount = signingConfig.configName.includes(
          "createAccountWithAddress"
        )
          ? createAccountWithAddress({
              client: turnkeyClient,
              organizationId,
              signWith: signingConfig.signWith,
            })
          : await createAccount({
              client: turnkeyClient,
              organizationId,
              signWith: signingConfig.signWith,
            });

        walletClient = createTestClient({
          account: turnkeyAccount,
          chain: foundry,
          mode: "anvil",
          transport: http(),
        })
          .extend(publicActions)
          .extend(walletActions);

        chain = walletClient.chain;

        await walletClient.setBalance({
          address: signingConfig.expectedEthAddress,
          value: parseEther("999999"),
        });
      });

      testCase("it is connected to the right address", async () => {
        const addresses = await walletClient.getAddresses();

        expect(turnkeyAccount.address).toEqual(
          signingConfig.expectedEthAddress
        );
        expect(addresses).toEqual([signingConfig.expectedEthAddress]);
      });

      testCase("it signs transactions", async () => {
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
        const transactionCount = await walletClient.getTransactionCount({
          address: signingConfig.expectedEthAddress,
        });

        const txHash = await walletClient.sendTransaction({
          account: turnkeyAccount,
          to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
          value: parseEther("1.0"),
          chain,
          nonce: transactionCount,
          gas: 21000n,
          maxFeePerGas: parseUnits("2", 9),
          maxPriorityFeePerGas: parseUnits("2", 9),
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
              maxPriorityFeePerGas: parseUnits("2", 9),
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
          message: { raw: stringToHex(message) },
        });
        const verified = await walletClient.verifyMessage({
          address: signingConfig.expectedEthAddress,
          message: message,
          signature: signMessageSignature,
        });

        expect(signMessageSignature).toMatch(/^0x/);
        expect(verified).toBeTruthy();
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

        const signTypedDataSignature = await walletClient.signTypedData(
          typedData
        );
        const verified = await walletClient.verifyTypedData({
          ...typedData,
          address: signingConfig.expectedEthAddress,
          signature: signTypedDataSignature,
        });

        expect(signTypedDataSignature).toMatch(/^0x/);
        expect(verified).toBeTruthy();
      });

      // NOTE: disabling this test case for now until we can also test via React Native app
      // describe("it signs walletconnect v1 payloads, bridged via EIP-1193", () => {
      //   // https://docs.walletconnect.com/1.0/json-rpc-api-methods/ethereum

      //   testCase("Uniswap payload", async () => {
      //     const payload: any = {
      //       id: 1683062025301507,
      //       jsonrpc: "2.0",
      //       method: "eth_sendTransaction",
      //       params: [
      //         {
      //           gas: "0x2fe08", // See comment below
      //           value: "0xf4240",
      //           from: signingConfig.expectedEthAddress, // See comment below
      //           to: "0x4648a43b2c14da09fdf82b161150d3f634f40491",
      //           data: "0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000006451840800000000000000000000000000000000000000000000000000000000000000020b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000677493600000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002bb4fbf271143f4fbf7b91a5ded31805e42b2208d6000bb81f9840a85d5af5bf1d1762f925bdaddc4201f984000000000000000000000000000000000000000000",
      //         },
      //       ],
      //     };

      //     // Looks like here, too, we are subject to similar issues as described below:
      //     // See https://github.com/ethers-io/ethers.js/issues/1683
      //     delete payload.params[0].gas;
      //     // In a real-world scenario you should also verify that `from` matches the wallet's address
      //     delete payload.params[0].from;

      //     // Anvil client seems to be able to host eip1193 requests just fine
      //     const tx = await walletClient.request(payload);
      //     expect(tx).toMatch(/^0x/);
      //   });
      // });

      // Use `pnpm run compile:contracts` to update the ABI if needed
      testCase("ERC-721", async () => {
        const { abi, bytecode } = Test721;

        const transactionCount = await walletClient.getTransactionCount({
          address: signingConfig.expectedEthAddress,
        });

        // Deploy
        const deployHash = await walletClient.deployContract({
          abi,
          chain,
          account: turnkeyAccount,
          bytecode: bytecode as Hex,
        });

        const contractAddress = getContractAddress({
          from: signingConfig.expectedEthAddress,
          nonce: transactionCount,
        });

        expect(deployHash).toMatch(/^0x/);
        expect(contractAddress).toMatch(/^0x/);

        // Create contract instance
        const contract = getContract({
          address: contractAddress,
          abi,
          client: walletClient,
        });

        // Mint
        // @ts-expect-error
        const mintHash = await contract.write.safeMint([
          signingConfig.expectedEthAddress,
        ]);

        expect(mintHash).toMatch(/^0x/);

        // Approve
        // @ts-expect-error
        const approveHash = await contract.write.approve([
          "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
          0, // `tokenId` is `0` because we've only minted once
        ]);

        expect(approveHash).toMatch(/^0x/);
      });
    });
  });
});

function assertNonEmptyString(input: unknown, name: string): string {
  if (typeof input !== "string" || !input) {
    throw new Error(`Expected non empty string for "${name}", got ${input}`);
  }

  return input;
}
