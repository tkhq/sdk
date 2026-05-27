import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { serverEnv } from "@/lib/env";

let turnkey: TurnkeySDKServer | undefined;

const SUPPORTED_EVM_CAIP2 = [
  "eip155:1",
  "eip155:11155111",
  "eip155:8453",
  "eip155:84532",
  "eip155:137",
  "eip155:80002",
] as const;

const DEFAULT_RPC_BY_CAIP2: Record<
  (typeof SUPPORTED_EVM_CAIP2)[number],
  string
> = {
  "eip155:1": "https://cloudflare-eth.com",
  "eip155:11155111": "https://ethereum-sepolia-rpc.publicnode.com",
  "eip155:8453": "https://mainnet.base.org",
  "eip155:84532": "https://sepolia.base.org",
  "eip155:137": "https://polygon-rpc.com",
  "eip155:80002": "https://rpc-amoy.polygon.technology",
};

type SupportedEvmCaip2 = (typeof SUPPORTED_EVM_CAIP2)[number];
const SUPPORTED_SVM_CAIP2 = [
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
] as const;

const DEFAULT_SOLANA_RPC_BY_CAIP2: Record<
  (typeof SUPPORTED_SVM_CAIP2)[number],
  string
> = {
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp":
    "https://api.mainnet-beta.solana.com",
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG":
    "https://api.devnet.solana.com",
};

const SOLANA_CAIP2_ALIASES: Record<
  string,
  (typeof SUPPORTED_SVM_CAIP2)[number]
> = {
  "solana:mainnet": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "solana:mainnet-beta": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "solana:devnet": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
};

type SupportedSvmCaip2 = (typeof SUPPORTED_SVM_CAIP2)[number];
type SendAssetType = "NATIVE" | "ERC20" | "SPL";

function getTurnkeyClient() {
  if (!turnkey) {
    turnkey = new TurnkeySDKServer({
      apiBaseUrl: serverEnv.baseUrl,
      apiPublicKey: serverEnv.apiPublicKey,
      apiPrivateKey: serverEnv.apiPrivateKey,
      defaultOrganizationId: serverEnv.organizationId,
    });
  }

  return turnkey;
}

export async function getBalances(params: { address: string; caip2: string }) {
  const { balances = [] } = await getTurnkeyClient()
    .apiClient()
    .getWalletAddressBalances({
      organizationId: serverEnv.organizationId,
      address: params.address,
      // The SDK currently narrows CAIP-2 to a generated union; this example accepts runtime input.
      caip2: params.caip2 as any,
    });

  return balances;
}

function isSupportedEvmCaip2(value: string): value is SupportedEvmCaip2 {
  return SUPPORTED_EVM_CAIP2.includes(value as SupportedEvmCaip2);
}

function normalizeSvmCaip2(value: string): SupportedSvmCaip2 | null {
  if (SUPPORTED_SVM_CAIP2.includes(value as SupportedSvmCaip2)) {
    return value as SupportedSvmCaip2;
  }

  return SOLANA_CAIP2_ALIASES[value] ?? null;
}

function getEvmRpcUrl(caip2: SupportedEvmCaip2): string {
  if (process.env.ETH_RPC_URL?.trim()) {
    return process.env.ETH_RPC_URL.trim();
  }

  return DEFAULT_RPC_BY_CAIP2[caip2];
}

function getSolanaRpcUrl(caip2: SupportedSvmCaip2): string {
  if (process.env.SOLANA_RPC_URL?.trim()) {
    return process.env.SOLANA_RPC_URL.trim();
  }

  return DEFAULT_SOLANA_RPC_BY_CAIP2[caip2];
}

async function rpcCall<T>(
  caip2: SupportedEvmCaip2,
  method: string,
  params: unknown[],
): Promise<T> {
  const response = await fetch(getEvmRpcUrl(caip2), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${method}-${Date.now()}`,
      method,
      params,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`RPC ${method} failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    result?: T;
    error?: { message?: string };
  };

  if (payload.error) {
    throw new Error(
      `RPC ${method} error: ${payload.error.message ?? "unknown"}`,
    );
  }

  if (payload.result === undefined) {
    throw new Error(`RPC ${method} returned no result`);
  }

  return payload.result;
}

async function getEip1559Fees(caip2: SupportedEvmCaip2): Promise<{
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}> {
  const zero = BigInt(0);
  const two = BigInt(2);

  const priorityHex = await rpcCall<string>(
    caip2,
    "eth_maxPriorityFeePerGas",
    [],
  ).catch(() => "0x3b9aca00"); // 1 gwei fallback
  const block = await rpcCall<{ baseFeePerGas?: string }>(
    caip2,
    "eth_getBlockByNumber",
    ["latest", false],
  );

  const maxPriorityFeePerGas = BigInt(priorityHex);
  const baseFeePerGas = block.baseFeePerGas
    ? BigInt(block.baseFeePerGas)
    : zero;
  const maxFeePerGas =
    baseFeePerGas > zero
      ? baseFeePerGas * two + maxPriorityFeePerGas
      : maxPriorityFeePerGas * two;

  return {
    maxFeePerGas: maxFeePerGas.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
  };
}

function toHexQuantity(value: string): string {
  return `0x${BigInt(value).toString(16)}`;
}

function encodeErc20Transfer(to: string, amountBaseUnits: string): string {
  const selector = "a9059cbb"; // transfer(address,uint256)
  const toWithoutPrefix = to.slice(2).toLowerCase();
  const amountHex = BigInt(amountBaseUnits).toString(16);
  const toPadded = toWithoutPrefix.padStart(64, "0");
  const amountPadded = amountHex.padStart(64, "0");
  return `0x${selector}${toPadded}${amountPadded}`;
}

async function estimateGasLimit(params: {
  caip2: SupportedEvmCaip2;
  from: string;
  to: string;
  value: string;
  data?: string;
  fallback: string;
}) {
  try {
    const estimatedHex = await rpcCall<string>(
      params.caip2,
      "eth_estimateGas",
      [
        {
          from: params.from,
          to: params.to,
          value: toHexQuantity(params.value),
          ...(params.data ? { data: params.data } : {}),
        },
      ],
    );

    return BigInt(estimatedHex).toString();
  } catch {
    return params.fallback;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEthTransactionUnsponsored(params: {
  from: string;
  to: string;
  amountBaseUnits: string;
  caip2: string;
  assetType: SendAssetType;
  tokenContractAddress?: string;
}) {
  if (!isSupportedEvmCaip2(params.caip2)) {
    throw new Error(
      `Unsupported EVM network: ${params.caip2}. Supported values: ${SUPPORTED_EVM_CAIP2.join(", ")}`,
    );
  }

  const apiClient = getTurnkeyClient().apiClient();
  const { nonce } = await apiClient.getNonces({
    organizationId: serverEnv.organizationId,
    address: params.from,
    caip2: params.caip2,
    nonce: true,
  });

  if (!nonce) {
    throw new Error("Unable to fetch nonce for sender address.");
  }

  const fees = await getEip1559Fees(params.caip2);

  const isErc20 = params.assetType === "ERC20";
  const transferData = isErc20
    ? encodeErc20Transfer(params.to, params.amountBaseUnits)
    : undefined;
  const txTo = isErc20 ? (params.tokenContractAddress ?? "") : params.to;
  const txValue = isErc20 ? "0" : params.amountBaseUnits;

  if (!txTo) {
    throw new Error("Missing token contract address for ERC20 transfer.");
  }

  const gasLimit = await estimateGasLimit({
    caip2: params.caip2,
    from: params.from,
    to: txTo,
    value: txValue,
    data: transferData,
    fallback: isErc20 ? "120000" : "21000",
  });

  const sendResponse = await apiClient.ethSendTransaction({
    organizationId: serverEnv.organizationId,
    from: params.from,
    to: txTo,
    value: txValue,
    ...(transferData ? { data: transferData } : {}),
    caip2: params.caip2,
    sponsor: false,
    nonce,
    gasLimit,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });

  const sendTransactionStatusId = sendResponse.sendTransactionStatusId;
  let txHash: string | undefined;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const status = await apiClient.getSendTransactionStatus({
      organizationId: serverEnv.organizationId,
      sendTransactionStatusId,
    });

    if (status.eth?.txHash) {
      txHash = status.eth.txHash;
      break;
    }

    if (status.txStatus === "TX_STATUS_FAILED") {
      throw new Error(status.txError ?? "Ethereum transaction failed");
    }

    await sleep(800);
  }

  return {
    sendTransactionStatusId,
    txHash,
  };
}

async function buildUnsignedSolanaTransactionHex(params: {
  from: string;
  to: string;
  amountBaseUnits: string;
  caip2: SupportedSvmCaip2;
  assetType: "NATIVE" | "SPL";
  tokenMintAddress?: string;
}) {
  const connection = new Connection(getSolanaRpcUrl(params.caip2), "confirmed");
  const fromPubkey = new PublicKey(params.from);
  const toPubkey = new PublicKey(params.to);
  const instructions = [];

  if (params.assetType === "SPL") {
    const mintAddress = params.tokenMintAddress?.trim();
    if (!mintAddress) {
      throw new Error("Missing token mint address for SPL transfer.");
    }

    const mintPubkey = new PublicKey(mintAddress);
    const sourceTokenAccount = getAssociatedTokenAddressSync(
      mintPubkey,
      fromPubkey,
    );
    const destinationTokenAccount = getAssociatedTokenAddressSync(
      mintPubkey,
      toPubkey,
    );

    const sourceInfo = await connection.getAccountInfo(sourceTokenAccount);
    if (!sourceInfo) {
      throw new Error(
        "Sender does not have an associated token account for this SPL token.",
      );
    }

    const destinationInfo = await connection.getAccountInfo(
      destinationTokenAccount,
    );
    if (!destinationInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          fromPubkey,
          destinationTokenAccount,
          toPubkey,
          mintPubkey,
        ),
      );
    }

    instructions.push(
      createTransferInstruction(
        sourceTokenAccount,
        destinationTokenAccount,
        fromPubkey,
        BigInt(params.amountBaseUnits),
      ),
    );
  } else {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: BigInt(params.amountBaseUnits),
      }),
    );
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return Buffer.from(new VersionedTransaction(message).serialize()).toString(
    "hex",
  );
}

export async function sendSolanaTransactionUnsponsored(params: {
  from: string;
  to: string;
  amountBaseUnits: string;
  caip2: string;
  assetType: "NATIVE" | "SPL";
  tokenMintAddress?: string;
}) {
  const normalizedCaip2 = normalizeSvmCaip2(params.caip2);
  if (!normalizedCaip2) {
    throw new Error(
      `Unsupported SVM network: ${params.caip2}. Supported values: ${[
        ...SUPPORTED_SVM_CAIP2,
        ...Object.keys(SOLANA_CAIP2_ALIASES),
      ].join(", ")}`,
    );
  }

  const unsignedTransaction = await buildUnsignedSolanaTransactionHex({
    ...params,
    caip2: normalizedCaip2,
  });

  const apiClient = getTurnkeyClient().apiClient();
  const sendResponse = await apiClient.solSendTransaction({
    organizationId: serverEnv.organizationId,
    signWith: params.from,
    unsignedTransaction,
    caip2: normalizedCaip2 as any,
    sponsor: false,
  });

  const sendTransactionStatusId = sendResponse.sendTransactionStatusId;
  let signature: string | undefined;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const status = await apiClient.getSendTransactionStatus({
      organizationId: serverEnv.organizationId,
      sendTransactionStatusId,
    });

    if (status.solana?.signature) {
      signature = status.solana.signature;
      break;
    }

    if (status.txStatus === "TX_STATUS_FAILED") {
      throw new Error(status.txError ?? "Solana transaction failed");
    }

    await sleep(800);
  }

  return {
    sendTransactionStatusId,
    signature,
  };
}

export async function sendAssetTransactionUnsponsored(params: {
  from: string;
  to: string;
  amountBaseUnits: string;
  caip2: string;
  assetType: SendAssetType;
  tokenContractAddress?: string;
  tokenMintAddress?: string;
}) {
  if (params.caip2.startsWith("eip155:")) {
    if (params.assetType === "SPL") {
      throw new Error("SPL transfers are only supported on Solana networks.");
    }

    return sendEthTransactionUnsponsored({
      ...params,
      assetType: params.assetType,
      tokenContractAddress: params.tokenContractAddress,
    });
  }

  if (params.caip2.startsWith("solana:")) {
    if (params.assetType === "ERC20") {
      throw new Error("ERC20 transfers are only supported on EVM networks.");
    }

    return sendSolanaTransactionUnsponsored({
      ...params,
      assetType: params.assetType,
      tokenMintAddress: params.tokenMintAddress,
    });
  }

  throw new Error(`Unsupported network: ${params.caip2}`);
}
