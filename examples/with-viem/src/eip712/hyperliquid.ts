// src/eip712/hyperliquid.ts
import * as path from "path";
import * as dotenv from "dotenv";

import { createAccount } from "@turnkey/viem";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  createWalletClient,
  createPublicClient,
  fallback,
  http,
  isAddressEqual,
  recoverTypedDataAddress,
  verifyTypedData,
  parseUnits,
  type Account,
} from "viem";
import { sepolia } from "viem/chains";
import { print, assertEqual } from "../util";
import { createNewWallet } from "../createNewWallet";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Minimal ERC-20 Permit (EIP-2612) ABI
const erc20PermitAbi = [
  { name: "name", stateMutability: "view", type: "function", inputs: [], outputs: [{ type: "string" }] },
  { name: "nonces", stateMutability: "view", type: "function", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "decimals", stateMutability: "view", type: "function", inputs: [], outputs: [{ type: "uint8" }] },
  {
    name: "permit",
    stateMutability: "nonpayable",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "allowance",
    stateMutability: "view",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

async function assertTypedDataSignature(params: {
  expectedAddress: `0x${string}`;
  domain: any;
  types: any;
  primaryType: string;
  message: any;
  signature: `0x${string}`;
}) {
  const { expectedAddress, ...payload } = params;

  const ok = await verifyTypedData({ address: expectedAddress, ...payload });
  if (!ok) throw new Error("Invalid EIP-712 signature (verifyTypedData=false)");

  const recovered = await recoverTypedDataAddress(payload);
  if (!isAddressEqual(recovered, expectedAddress)) {
    throw new Error(`Recovered ${recovered} != expected ${expectedAddress}`);
  }
}

// Standard permit (small value)
async function doPermitOnSepolia({
  walletClient,
  publicClient,
  owner,
  token,
  spender,
  amount = "0.01",
}: {
  walletClient: any;
  publicClient: any;
  owner: `0x${string}`;
  token: `0x${string}`;
  spender: `0x${string}`;
  amount?: string;
}) {
  const [name, nonce, decimals] = await Promise.all([
    publicClient.readContract({ address: token, abi: erc20PermitAbi, functionName: "name" }),
    publicClient.readContract({ address: token, abi: erc20PermitAbi, functionName: "nonces", args: [owner] }),
    publicClient.readContract({ address: token, abi: erc20PermitAbi, functionName: "decimals" }),
  ]);

  const value = parseUnits(amount, decimals);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);

  const domain = { name, version: "1", chainId: sepolia.id, verifyingContract: token } as const;
  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  } as const;
  const message = { owner, spender, value, nonce, deadline } as const;

  const sig = await walletClient.signTypedData({ domain, types, primaryType: "Permit", message });
  const r = `0x${sig.slice(2, 66)}` as `0x${string}`;
  const s = `0x${sig.slice(66, 130)}` as `0x${string}`;
  let v = parseInt(sig.slice(130, 132), 16);
  if (v < 27) v += 27;

  const txHash = await walletClient.writeContract({
    address: token,
    abi: erc20PermitAbi,
    functionName: "permit",
    args: [owner, spender, value, deadline, v, r, s],
  });
  console.log("permit() tx:", txHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("receipt status:", receipt.status, "gasUsed:", receipt.gasUsed?.toString());
  if (receipt.status !== "success") throw new Error("permit() transaction reverted");

  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20PermitAbi,
    functionName: "allowance",
    args: [owner, spender],
  });
  console.log("allowance:", allowance.toString());
}

// BigInt permit (huge value)
async function doPermitOnSepoliaBigInt({
  walletClient,
  publicClient,
  owner,
  token,
  spender,
}: {
  walletClient: any;
  publicClient: any;
  owner: `0x${string}`;
  token: `0x${string}`;
  spender: `0x${string}`;
}) {
  const [name, nonce] = await Promise.all([
    publicClient.readContract({ address: token, abi: erc20PermitAbi, functionName: "name" }),
    publicClient.readContract({ address: token, abi: erc20PermitAbi, functionName: "nonces", args: [owner] }),
  ]);

  const bigValue = (2n ** 200n);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);

  const domain = { name, version: "1", chainId: sepolia.id, verifyingContract: token } as const;
  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  } as const;
  const message = { owner, spender, value: bigValue, nonce, deadline } as const;

  const sig = await walletClient.signTypedData({ domain, types, primaryType: "Permit", message });
  const r = `0x${sig.slice(2, 66)}` as `0x${string}`;
  const s = `0x${sig.slice(66, 130)}` as `0x${string}`;
  let v = parseInt(sig.slice(130, 132), 16);
  if (v < 27) v += 27;

  const txHash = await walletClient.writeContract({
    address: token,
    abi: erc20PermitAbi,
    functionName: "permit",
    args: [owner, spender, bigValue, deadline, v, r, s],
  });
  console.log("bigint permit() tx:", txHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("bigint receipt status:", receipt.status, "gasUsed:", receipt.gasUsed?.toString());
  if (receipt.status !== "success") throw new Error("bigint permit() transaction reverted");

  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20PermitAbi,
    functionName: "allowance",
    args: [owner, spender],
  });
  console.log("bigint allowance:", allowance.toString());

  if (allowance !== bigValue) {
    throw new Error(`On-chain allowance mismatch. expected=${bigValue} got=${allowance}`);
  }
  console.log("✅ On-chain BigInt allowance matches exactly");
}

async function main() {
  if (!process.env.SIGN_WITH) {
    // Creates a new wallet if SIGN_WITH not provided
    await createNewWallet();
    return;
  }

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    }),
  );

  const turnkeyAccount = await createAccount({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  // Fallback transport to dodge rate limits
  const transport = fallback(
    [
      process.env.INFURA_API_KEY
        ? http(`https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`, {
            retryCount: 3,
            retryDelay: 500,
          })
        : undefined,
      http("https://1rpc.io/sepolia"),
      http("https://ethereum-sepolia.publicnode.com"),
      http("https://rpc.sepolia.org"),
    ].filter(Boolean) as any,
  );

  const walletClient = createWalletClient({
    account: turnkeyAccount as Account,
    chain: sepolia,
    transport,
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport,
  });

  const address = walletClient.account.address as `0x${string}`;
  print("Address:", address);

  // --- Off-chain EIP-712 example
  const domain = {
    name: "HyperliquidSignTransaction",
    version: "1",
    chainId: 1,
    verifyingContract: "0x0000000000000000000000000000000000000000",
  } as const;

  const types = {
    "HyperliquidTransaction:ApproveAgent": [
      { name: "hyperliquidChain", type: "string" },
      { name: "agentAddress", type: "address" },
      { name: "agentName", type: "string" },
      { name: "nonce", type: "uint64" },
    ],
  } as const;

  const payload = {
    account: turnkeyAccount as Account,
    domain,
    types,
    primaryType: "HyperliquidTransaction:ApproveAgent",
    message: {
      hyperliquidChain: "Testnet",
      signatureChainId: "0x1",
      agentAddress: "0x279f28cbbf5bd83c568ff6b599420b473319c25f",
      agentName: "Mobile QR",
      nonce: 1751566432540n,
      type: "approveAgent",
    },
  } as const;

  const signature = await walletClient.signTypedData(payload);
  const recoveredAddress = await recoverTypedDataAddress({ ...payload, signature });
  print("Turnkey-powered signature - typed data (EIP-712):", `${signature}`);
  await assertTypedDataSignature({
    expectedAddress: address,
    domain,
    types,
    primaryType: payload.primaryType,
    message: payload.message,
    signature,
  });
  console.log("✅ EIP-712 signature verified");
  assertEqual(address, recoveredAddress);

  // On-chain proof: ERC-2612 Permit (small value)
  const token =
    (process.env.TOKEN_ADDRESS as `0x${string}`) ||
    ((): never => {
      throw new Error("Set TOKEN_ADDRESS in .env.local to a Sepolia ERC-2612 token.");
    })();
  const spender =
    (process.env.SPENDER_ADDRESS as `0x${string}`) ||
    "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7";

  await doPermitOnSepolia({ walletClient, publicClient, owner: address, token, spender, amount: "0.01" });

  await doPermitOnSepoliaBigInt({ walletClient, publicClient, owner: address, token, spender });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
