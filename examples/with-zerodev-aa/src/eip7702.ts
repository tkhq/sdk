import { resolve } from "path";
import * as dotenv from "dotenv";

import {
  createPublicClient,
  createWalletClient,
  http,
  zeroAddress,
} from "viem";
import { sepolia } from "viem/chains";
import {
  getEntryPoint,
  KERNEL_V3_3_BETA,
  KernelVersionToAddressesMap,
} from "@zerodev/sdk/constants";
import { createKernelAccountClient } from "@zerodev/sdk";
import { createKernelAccount } from "@zerodev/sdk/accounts";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { createZeroDevPaymasterClient } from "@zerodev/sdk";

import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

// Load environment variables from `.env.local`
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

if (!process.env.ZERODEV_RPC) {
  throw new Error("ZERODEV_RPC is not set");
}

const ZERODEV_RPC = process.env.ZERODEV_RPC;
const entryPoint = getEntryPoint("0.7");
const kernelVersion = KERNEL_V3_3_BETA;

// We use the Sepolia testnet here, but you can use any network that
// supports EIP-7702.
const chain = sepolia;

const publicClient = createPublicClient({
  transport: http(),
  chain,
});

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: process.env.BASE_URL!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.ORGANIZATION_ID!,
  // The following config is useful in contexts where an activity requires consensus.
  // By default, if the activity is not initially successful, it will poll a maximum
  // of 3 times with an interval of 10000 milliseconds.
  //
  // -----
  //
  // activityPoller: {
  //   intervalMs: 10_000,
  //   numRetries: 5,
  // },
});

const main = async () => {
  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const walletClient = createWalletClient({
    // Use any Viem-compatible EOA account
    account: turnkeyAccount,
    chain,
    transport: http(),
  });

  console.log("eoa address", turnkeyAccount.address);

  console.log("authorization params", {
    contractAddress:
      KernelVersionToAddressesMap[kernelVersion].accountImplementationAddress,
    account: turnkeyAccount,
  });

  const authorization = await walletClient.signAuthorization({
    contractAddress:
      KernelVersionToAddressesMap[kernelVersion].accountImplementationAddress,
    account: turnkeyAccount,
  });

  console.log("validator params", {
    signer: turnkeyAccount,
    entryPoint,
    kernelVersion,
  });

  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: turnkeyAccount,
    entryPoint,
    kernelVersion,
  });

  console.log("account params", {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint,
    kernelVersion,
    // Set the address of the smart account to the EOA address
    address: turnkeyAccount.address,
    // Set the 7702 authorization
    eip7702Auth: authorization,
  });

  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint,
    kernelVersion,
    // Set the address of the smart account to the EOA address
    address: turnkeyAccount.address,
    // Set the 7702 authorization
    eip7702Auth: authorization,
  });

  const paymasterClient = createZeroDevPaymasterClient({
    chain,
    transport: http(ZERODEV_RPC),
  });

  const kernelClient = createKernelAccountClient({
    account,
    chain,
    bundlerTransport: http(ZERODEV_RPC),
    paymaster: {
      getPaymasterData: (userOperation) => {
        return paymasterClient.sponsorUserOperation({
          userOperation,
        });
      },
    },
    client: publicClient,
  });

  const userOpHash = await kernelClient.sendUserOperation({
    callData: await kernelClient.account.encodeCalls([
      {
        to: zeroAddress,
        value: BigInt(0),
        data: "0x",
      },
      {
        to: zeroAddress,
        value: BigInt(0),
        data: "0x",
      },
    ]),
  });
  console.log("UserOp sent:", userOpHash);
  console.log("Waiting for UserOp to be completed...");

  const { receipt } = await kernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });
  console.log(
    "UserOp completed",
    `${chain.blockExplorers.default.url}/tx/${receipt.transactionHash}`
  );

  process.exit(0);
};

main();
