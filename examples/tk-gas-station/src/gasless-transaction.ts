// @ts-nocheck
import * as dotenv from "dotenv";
import { resolve } from "path";
import { ethers } from "ethers";
import { TurnkeySigner } from "@turnkey/ethers";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import prompts from "prompts";
import {
  SignedAuthorization,
  createWalletClient,
  createPublicClient,
  http,
  serializeTransaction,
} from "viem";
import { sepolia } from "viem/chains";
import { createAccount } from "@turnkey/viem";
import gassyAbi from "../abi/gassy-abi.json";
import gassyStationAbi from "../abi/gassy-station-abi.json";

// Load environment variables from `.env.local`
dotenv.config({ path: resolve(process.cwd(), ".env.local") });


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
  // 1. userSignAuthorization
  // 2. payAuthorization
  // 3. sign712SingleTransaction
  // 4. payTransaction
}


const userSignAuthorization = async (
  turnkeyClient: TurnkeyServerSDK,
  chain: any, // accepts a viem Chain object or minimal { id: number }
  eip7702ContractAddress: `0x${string}`
): Promise<SignedAuthorization> => {
  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const walletClient = createWalletClient({
    account: turnkeyAccount,
    chain,
    transport: http(),
  });

  const authorization = await walletClient.signAuthorization({
    contractAddress: eip7702ContractAddress,
    account: turnkeyAccount,
  });

  return authorization as SignedAuthorization;
};
const payAuthorization = async (
  turnkeyClient: TurnkeyServerSDK, 
  authorization: SignedAuthorization,
  eoaAddress: `0x${string}`,
  chain: any, // accepts a viem Chain object or minimal { id: number }
) => {
  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const walletClient = createWalletClient({
    account: turnkeyAccount,
    chain,
    transport: http(),
  });

  const txHash = await walletClient.sendTransaction({
    from: "0x0000000000000000000000000000000000000000", // TODO: set to desired sender if needed
    gas: BigInt(200000),
    authorizationList: [authorization as SignedAuthorization],
    to: eoaAddress,
    type: "eip7702",
    account: turnkeyAccount,
  });

  return txHash;
}

const sign712SingleTransaction = async (
  turnkeyClient: TurnkeyServerSDK,
  chain: any,
  verifyingContract: `0x${string}`,
  nonce: bigint,
  outputContract: `0x${string}`,
  ethAmount: bigint,
  argsBytes: `0x${string}`,
): Promise<`0x${string}`> => {
  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const publicClient = createPublicClient({ chain, transport: http() });
  const domainInfo = await publicClient.readContract({
    address: verifyingContract,
    abi: gassyStationAbi as any,
    functionName: "eip712Domain",
  });

  const name = domainInfo[1] as string;
  const version = domainInfo[2] as string;

  const walletClient = createWalletClient({ account: turnkeyAccount, chain, transport: http() });

  const signature = await walletClient.signTypedData({
    account: turnkeyAccount,
    domain: {
      name,
      version,
      chainId: chain.id,
      verifyingContract,
    },
    primaryType: "Execution",
    types: {
      Execution: [
        { name: "nonce", type: "uint256" },
        { name: "outputContract", type: "address" },
        { name: "ethAmount", type: "uint256" },
        { name: "arguments", type: "bytes" },
      ],
    },
    message: {
      nonce,
      outputContract,
      ethAmount,
      arguments: argsBytes,
    },
  });

  return signature as `0x${string}`;
}

const sign712SingleTransactionUsingCurrentNonce = async (
  turnkeyClient: TurnkeyServerSDK,
  chain: any,
  verifyingContract: `0x${string}`,
  sender: `0x${string}`,
  outputContract: `0x${string}`,
  ethAmount: bigint,
  argsBytes: `0x${string}`,
): Promise<{ signature: `0x${string}`; nonce: bigint }> => {
  const publicClient = createPublicClient({ chain, transport: http() });
  const currentNonce = await publicClient.readContract({
    address: verifyingContract,
    abi: gassyStationAbi as any,
    functionName: "nonce",
    args: [sender],
  });

  const signature = await sign712SingleTransaction(
    turnkeyClient,
    chain,
    verifyingContract,
    BigInt(currentNonce as any),
    outputContract,
    ethAmount,
    argsBytes,
  );

  return { signature: signature as `0x${string}`, nonce: BigInt(currentNonce as any) };
}

const payTransaction = async (
  turnkeyClient: TurnkeyServerSDK, 
  contractAddress: `0x${string}`, 
  chain: any,
  functionName: string,
  functionArgs: `0x${string}`[],
  functionGas: bigint,
  functionGasLimit: bigint,
  functionGasPrice: bigint,
) => { 
  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const walletClient = createWalletClient({
    account: turnkeyAccount,
    chain,
    transport: http(),
  });

  const iface = new ethers.Interface(gassyAbi as any);
  const data = iface.encodeFunctionData(functionName, functionArgs);

  const txHash = await walletClient.sendTransaction({
    to: contractAddress,
    data,
    gas: functionGasLimit,
    gasPrice: functionGasPrice,
    value: 0n,
    account: turnkeyAccount,
  });

  return txHash;
}
