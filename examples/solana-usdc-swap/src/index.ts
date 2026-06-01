import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  decodeInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  isCloseAccountInstruction,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import fetch from "cross-fetch";
import prompts from "prompts";
import { getTurnkeyClient, pollTransactionStatus } from "./turnkey";
import { SOL_MINT, USDC_MAINNET } from "./tokens";
import { lamportsToSol, solToLamports } from "./utils";

const MAINNET_CONFIG = {
  rpc: "https://api.mainnet-beta.solana.com",
  caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  usdcMint: USDC_MAINNET,
  jupiterBaseUrl: "https://api.jup.ag",
  jupiterQuotePath: "/swap/v1/quote",
  jupiterSwapPath: "/swap/v1/swap",
  jupiterSwapInstructionsPath: "/swap/v1/swap-instructions",
  explorerSuffix: "",
} as const;

type SolanaCaip2 = typeof MAINNET_CONFIG.caip2;
type RentStrategy = "precreated-accounts" | "strip-close-instructions";

type JupiterInstructionPayload = {
  programId: string;
  accounts: {
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  data: string;
};

type JupiterSwapInstructionsResponse = {
  error?: string;
  tokenLedgerInstruction?: JupiterInstructionPayload;
  computeBudgetInstructions?: JupiterInstructionPayload[];
  setupInstructions?: JupiterInstructionPayload[];
  swapInstruction?: JupiterInstructionPayload;
  cleanupInstruction?: JupiterInstructionPayload | null;
  otherInstructions?: JupiterInstructionPayload[];
  addressLookupTableAddresses?: string[];
};

async function parseJsonResponse(response: Response): Promise<any> {
  const textBody = await response.text();
  if (!textBody) return {};
  try {
    return JSON.parse(textBody);
  } catch {
    return { raw: textBody };
  }
}

async function fetchQuote(request: {
  amountLamports: bigint;
  outputMint: string;
  signWith: string;
  jupiterApiKey: string;
}) {
  const quoteUrl =
    `${MAINNET_CONFIG.jupiterBaseUrl}${MAINNET_CONFIG.jupiterQuotePath}` +
    `?inputMint=${SOL_MINT}` +
    `&outputMint=${request.outputMint}` +
    `&amount=${request.amountLamports.toString()}` +
    "&slippageBps=50";

  const quoteHttpResponse = await fetch(quoteUrl, {
    headers: {
      "x-api-key": request.jupiterApiKey,
    },
  });
  const quoteResponse = await parseJsonResponse(quoteHttpResponse);
  if (!quoteHttpResponse.ok || !quoteResponse?.routePlan) {
    throw new Error(
      `Quote request failed (status ${quoteHttpResponse.status}): ${JSON.stringify(quoteResponse)}`,
    );
  }

  return quoteResponse;
}

async function fetchSwapTransaction(request: {
  amountLamports: bigint;
  outputMint: string;
  signWith: string;
  jupiterApiKey: string;
}) {
  const quoteResponse = await fetchQuote(request);
  const swapHttpResponse = await fetch(
    `${MAINNET_CONFIG.jupiterBaseUrl}${MAINNET_CONFIG.jupiterSwapPath}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": request.jupiterApiKey,
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: request.signWith,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    },
  );
  const swapResp = await parseJsonResponse(swapHttpResponse);
  if (!swapHttpResponse.ok || !swapResp?.swapTransaction) {
    throw new Error(
      `Swap request failed (status ${swapHttpResponse.status}): ${JSON.stringify(swapResp)}`,
    );
  }

  return swapResp;
}

async function fetchSwapInstructions(
  request: {
    amountLamports: bigint;
    outputMint: string;
    signWith: string;
    jupiterApiKey: string;
  },
  bodyOverrides: Record<string, unknown>,
) {
  const quoteResponse = await fetchQuote(request);
  const swapInstructionsHttpResponse = await fetch(
    `${MAINNET_CONFIG.jupiterBaseUrl}${MAINNET_CONFIG.jupiterSwapInstructionsPath}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": request.jupiterApiKey,
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: request.signWith,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
        ...bodyOverrides,
      }),
    },
  );
  const instructions = (await parseJsonResponse(
    swapInstructionsHttpResponse,
  )) as JupiterSwapInstructionsResponse;
  if (
    !swapInstructionsHttpResponse.ok ||
    instructions.error ||
    !instructions.swapInstruction
  ) {
    throw new Error(
      `Swap instructions request failed (status ${swapInstructionsHttpResponse.status}): ${JSON.stringify(instructions)}`,
    );
  }

  return instructions;
}

function deserializeJupiterInstruction(
  instruction: JupiterInstructionPayload,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((account) => ({
      pubkey: new PublicKey(account.pubkey),
      isSigner: account.isSigner,
      isWritable: account.isWritable,
    })),
    data: Buffer.from(instruction.data, "base64"),
  });
}

async function getAddressLookupTableAccounts(
  connection: Connection,
  addresses: string[],
) {
  const lookupTableAccounts = await Promise.all(
    addresses.map(async (address) => {
      const lookupTableAddress = new PublicKey(address);
      const lookupTableAccount =
        await connection.getAccountInfo(lookupTableAddress);
      if (!lookupTableAccount) {
        throw new Error(`Missing address lookup table: ${address}`);
      }

      return new AddressLookupTableAccount({
        key: lookupTableAddress,
        state: AddressLookupTableAccount.deserialize(lookupTableAccount.data),
      });
    }),
  );

  return lookupTableAccounts;
}

function isCloseAccountRefundingToSigner(
  instruction: TransactionInstruction,
  signer: PublicKey,
) {
  if (!instruction.programId.equals(TOKEN_PROGRAM_ID)) {
    return false;
  }

  try {
    const decoded = decodeInstruction(instruction, TOKEN_PROGRAM_ID);
    return (
      isCloseAccountInstruction(decoded) &&
      decoded.keys.destination.pubkey.equals(signer)
    );
  } catch {
    return false;
  }
}

async function buildTransactionFromInstructions({
  connection,
  owner,
  instructionsResponse,
  cleanupMode,
}: {
  connection: Connection;
  owner: PublicKey;
  instructionsResponse: JupiterSwapInstructionsResponse;
  cleanupMode: "reject" | "strip-close-account";
}) {
  const setupInstructions = instructionsResponse.setupInstructions ?? [];
  const cleanupInstruction = instructionsResponse.cleanupInstruction ?? null;

  if (cleanupMode === "reject") {
    if (setupInstructions.length > 0) {
      throw new Error(
        "Jupiter returned setup instructions. This sponsored safe path expects token accounts to be prepared before the swap.",
      );
    }
    if (cleanupInstruction) {
      throw new Error(
        "Jupiter returned a cleanup instruction. This sponsored safe path rejects cleanup because it can refund rent to the signer.",
      );
    }
  }

  const instructions: TransactionInstruction[] = [
    ...(instructionsResponse.computeBudgetInstructions ?? []).map(
      deserializeJupiterInstruction,
    ),
    ...setupInstructions.map(deserializeJupiterInstruction),
    ...(instructionsResponse.tokenLedgerInstruction
      ? [
          deserializeJupiterInstruction(
            instructionsResponse.tokenLedgerInstruction,
          ),
        ]
      : []),
    ...(instructionsResponse.otherInstructions ?? []).map(
      deserializeJupiterInstruction,
    ),
    deserializeJupiterInstruction(instructionsResponse.swapInstruction!),
  ];

  let strippedCloseAccountInstructions = 0;
  if (cleanupInstruction) {
    const cleanup = deserializeJupiterInstruction(cleanupInstruction);
    const shouldStrip =
      cleanupMode === "strip-close-account" &&
      isCloseAccountRefundingToSigner(cleanup, owner);

    if (shouldStrip) {
      strippedCloseAccountInstructions += 1;
    } else {
      instructions.push(cleanup);
    }
  }

  const addressLookupTableAccounts = await getAddressLookupTableAccounts(
    connection,
    instructionsResponse.addressLookupTableAddresses ?? [],
  );
  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: owner,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(addressLookupTableAccounts);

  return {
    unsignedTransaction: Buffer.from(
      new VersionedTransaction(message).serialize(),
    ).toString("hex"),
    strippedCloseAccountInstructions,
  };
}

async function getTokenAccountReadiness({
  connection,
  owner,
  usdcMint,
}: {
  connection: Connection;
  owner: PublicKey;
  usdcMint: PublicKey;
}) {
  const wsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, owner);
  const usdcAta = getAssociatedTokenAddressSync(usdcMint, owner);
  let wsolExists = false;
  let usdcExists = false;
  let wsolBalance = 0n;

  try {
    const wsolAccount = await getAccount(connection, wsolAta);
    wsolExists = true;
    wsolBalance = wsolAccount.amount;
  } catch (error) {
    if (!(error instanceof TokenAccountNotFoundError)) {
      throw error;
    }
  }

  try {
    await getAccount(connection, usdcAta);
    usdcExists = true;
  } catch (error) {
    if (!(error instanceof TokenAccountNotFoundError)) {
      throw error;
    }
  }

  return { wsolAta, usdcAta, wsolExists, usdcExists, wsolBalance };
}

async function buildPrepareAccountsTransaction({
  connection,
  owner,
  usdcMint,
  wrapLamports,
}: {
  connection: Connection;
  owner: PublicKey;
  usdcMint: PublicKey;
  wrapLamports: bigint;
}) {
  const readiness = await getTokenAccountReadiness({
    connection,
    owner,
    usdcMint,
  });
  const instructions = [
    createAssociatedTokenAccountIdempotentInstruction(
      owner,
      readiness.wsolAta,
      owner,
      NATIVE_MINT,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      owner,
      readiness.usdcAta,
      owner,
      usdcMint,
    ),
  ];

  if (wrapLamports > 0n) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: readiness.wsolAta,
        lamports: wrapLamports,
      }),
      createSyncNativeInstruction(readiness.wsolAta),
    );
  }

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: owner,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return {
    ...readiness,
    unsignedTransaction: Buffer.from(
      new VersionedTransaction(message).serialize(),
    ).toString("hex"),
  };
}

async function assertPrecreatedTokenAccounts({
  connection,
  owner,
  usdcMint,
  amountLamports,
}: {
  connection: Connection;
  owner: PublicKey;
  usdcMint: PublicKey;
  amountLamports: bigint;
}) {
  const readiness = await getTokenAccountReadiness({
    connection,
    owner,
    usdcMint,
  });

  if (!readiness.wsolExists) {
    throw new Error(
      `Missing WSOL token account ${readiness.wsolAta.toBase58()}`,
    );
  }
  if (readiness.wsolBalance < amountLamports) {
    throw new Error(
      `Insufficient WSOL balance in ${readiness.wsolAta.toBase58()}`,
    );
  }
  if (!readiness.usdcExists) {
    throw new Error(
      `Missing USDC token account ${readiness.usdcAta.toBase58()}`,
    );
  }

  return readiness;
}

async function prepareAccountsIfNeeded({
  organizationId,
  connection,
  owner,
  usdcMint,
  amountLamports,
}: {
  organizationId: string;
  connection: Connection;
  owner: PublicKey;
  usdcMint: PublicKey;
  amountLamports: bigint;
}) {
  const readiness = await getTokenAccountReadiness({
    connection,
    owner,
    usdcMint,
  });

  if (
    readiness.wsolExists &&
    readiness.usdcExists &&
    readiness.wsolBalance >= amountLamports
  ) {
    console.log("Pre-created token accounts are ready.");
    console.log(`WSOL ATA: ${readiness.wsolAta.toBase58()}`);
    console.log(`USDC ATA: ${readiness.usdcAta.toBase58()}`);
    console.log(`WSOL balance: ${lamportsToSol(readiness.wsolBalance)} WSOL\n`);
    return;
  }

  console.log("Pre-created token accounts need preparation.");
  console.log(`WSOL ATA exists: ${readiness.wsolExists ? "yes" : "no"}`);
  console.log(`USDC ATA exists: ${readiness.usdcExists ? "yes" : "no"}`);
  console.log(`WSOL balance: ${lamportsToSol(readiness.wsolBalance)} WSOL`);
  console.log(
    "Preparation is sponsored and contains no close-account cleanup. This can subsidize token-account rent, but it will not automatically refund that rent to the signer.\n",
  );

  const suggestedWrapLamports =
    readiness.wsolBalance >= amountLamports
      ? 0n
      : amountLamports - readiness.wsolBalance;
  const { prepareNow } = await prompts({
    type: "confirm",
    name: "prepareNow",
    message: "Prepare token accounts now with sponsorship?",
    initial: true,
  });
  if (!prepareNow) {
    throw new Error("Sponsored swap cancelled before account preparation.");
  }

  const { wrapAmountInput } = await prompts({
    type: "text",
    name: "wrapAmountInput",
    message:
      "Amount of SOL to wrap during sponsored preparation (0 creates token accounts only):",
    initial: lamportsToSol(suggestedWrapLamports),
  });
  if (!wrapAmountInput) {
    throw new Error("Sponsored swap cancelled before account preparation.");
  }

  const wrapLamports = solToLamports(wrapAmountInput);
  if (wrapLamports < suggestedWrapLamports) {
    throw new Error(
      `Wrap amount is too low. Need at least ${lamportsToSol(suggestedWrapLamports)} SOL to cover this swap.`,
    );
  }

  const signerBalanceLamports = await connection.getBalance(owner);
  if (BigInt(signerBalanceLamports) < wrapLamports) {
    throw new Error(
      `Insufficient signer SOL to wrap ${wrapAmountInput} SOL. Sponsorship covers transaction costs and token-account rent; the swap input still needs to come from the signer.`,
    );
  }

  const prepared = await buildPrepareAccountsTransaction({
    connection,
    owner,
    usdcMint,
    wrapLamports,
  });
  const signature = await sendWithTurnkey({
    organizationId,
    unsignedTransaction: prepared.unsignedTransaction,
    signWith: owner.toBase58(),
    caip2: MAINNET_CONFIG.caip2,
    sponsored: true,
  });

  console.log("Prepared token accounts.");
  console.log(
    `Prep tx: https://explorer.solana.com/tx/${signature}${MAINNET_CONFIG.explorerSuffix}\n`,
  );
}

async function getRentStrategy(): Promise<RentStrategy> {
  const { rentStrategy } = await prompts({
    type: "select",
    name: "rentStrategy",
    message: "How should this sponsored swap avoid rent leakage?",
    choices: [
      {
        title: "Use pre-created token accounts",
        description:
          "Recommended: prepares accounts first, then rejects swap setup/cleanup.",
        value: "precreated-accounts",
      },
      {
        title: "Advanced: strip cleanup, rent remains locked",
        description:
          "Prevents same-transaction rent refunds, but is not the preferred production default.",
        value: "strip-close-instructions",
      },
    ],
    initial: 0,
  });

  if (!rentStrategy) {
    throw new Error("Swap cancelled.");
  }

  return rentStrategy;
}

async function sendWithTurnkey({
  organizationId,
  unsignedTransaction,
  signWith,
  caip2,
  sponsored,
}: {
  organizationId: string;
  unsignedTransaction: string;
  signWith: string;
  caip2: SolanaCaip2;
  sponsored: boolean;
}) {
  const turnkey = getTurnkeyClient();
  const { sendTransactionStatusId } = await turnkey
    .apiClient()
    .solSendTransaction({
      organizationId,
      unsignedTransaction,
      signWith,
      caip2,
      sponsor: sponsored,
    });

  const status = await pollTransactionStatus({
    apiClient: turnkey.apiClient(),
    organizationId,
    sendTransactionStatusId,
  });
  const signature = status.solana?.signature;
  if (!signature) {
    throw new Error(
      `Missing Solana transaction signature (status: ${status.txStatus})`,
    );
  }

  return signature;
}

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const signWith = process.env.SIGN_WITH!;
  const jupiterApiKey = process.env.JUPITER_API_KEY!;
  if (!organizationId || !signWith || !jupiterApiKey) {
    throw new Error("Missing ORGANIZATION_ID, SIGN_WITH, or JUPITER_API_KEY");
  }

  const connection = new Connection(MAINNET_CONFIG.rpc, "confirmed");
  const owner = new PublicKey(signWith);
  const usdcMint = new PublicKey(MAINNET_CONFIG.usdcMint);

  const balanceLamports = await connection.getBalance(owner);
  const { sponsored } = await prompts({
    type: "confirm",
    name: "sponsored",
    message: "Use Turnkey gas sponsorship?",
    initial: false,
  });
  const rentStrategy = sponsored ? await getRentStrategy() : undefined;
  const { amountInput } = await prompts({
    type: "text",
    name: "amountInput",
    message:
      sponsored && rentStrategy === "precreated-accounts"
        ? "Amount of SOL/WSOL to swap into USDC:"
        : "Amount of SOL to swap into USDC:",
    initial: "0.00005",
  });

  if (!amountInput) {
    console.log("Swap cancelled.");
    return;
  }

  const amountLamports = solToLamports(amountInput);
  if (amountLamports <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

  console.log(`\nSigner: ${signWith}`);
  console.log(`SOL balance: ${lamportsToSol(balanceLamports)} SOL`);
  console.log(`Swap amount: ${amountInput} SOL`);
  console.log(`Sponsored: ${sponsored ? "yes" : "no"}`);
  if (sponsored) {
    console.log(`Rent strategy: ${rentStrategy}\n`);
  } else {
    console.log("");
  }

  const feeBufferLamports = 5_000n;
  const minimumRequired = sponsored
    ? amountLamports
    : amountLamports + feeBufferLamports;
  if (
    rentStrategy !== "precreated-accounts" &&
    BigInt(balanceLamports) < minimumRequired
  ) {
    throw new Error("Insufficient SOL balance for requested swap amount.");
  }

  const request = {
    amountLamports,
    outputMint: MAINNET_CONFIG.usdcMint,
    signWith,
    jupiterApiKey,
  };

  let unsignedTransaction: string;
  let strippedCloseAccountInstructions = 0;

  if (!sponsored) {
    const swapResp = await fetchSwapTransaction(request);
    const unsignedBase64 = swapResp?.swapTransaction as string | undefined;
    if (!unsignedBase64) {
      throw new Error("Jupiter did not return a swap transaction payload.");
    }
    unsignedTransaction = Buffer.from(unsignedBase64, "base64").toString("hex");
  } else if (rentStrategy === "precreated-accounts") {
    await prepareAccountsIfNeeded({
      organizationId,
      connection,
      owner,
      usdcMint,
      amountLamports,
    });
    const { usdcAta } = await assertPrecreatedTokenAccounts({
      connection,
      owner,
      usdcMint,
      amountLamports,
    });
    const instructions = await fetchSwapInstructions(request, {
      wrapAndUnwrapSol: false,
      destinationTokenAccount: usdcAta.toBase58(),
      useSharedAccounts: true,
    });
    ({ unsignedTransaction, strippedCloseAccountInstructions } =
      await buildTransactionFromInstructions({
        connection,
        owner,
        instructionsResponse: instructions,
        cleanupMode: "reject",
      }));
  } else {
    console.warn(
      "Advanced mode: stripping close-account cleanup only prevents the sponsored rent refund from returning to the signer in this transaction. It can leave sponsor-funded rent locked in a signer-controlled account. Production systems should prefer pre-created accounts, close authority controls, or an explicit recouping model.",
    );
    const instructions = await fetchSwapInstructions(request, {
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
    });
    ({ unsignedTransaction, strippedCloseAccountInstructions } =
      await buildTransactionFromInstructions({
        connection,
        owner,
        instructionsResponse: instructions,
        cleanupMode: "strip-close-account",
      }));
  }

  if (strippedCloseAccountInstructions > 0) {
    console.log(
      `Stripped ${strippedCloseAccountInstructions} close-account cleanup instruction(s).`,
    );
  }

  const signature = await sendWithTurnkey({
    organizationId,
    unsignedTransaction,
    signWith,
    caip2: MAINNET_CONFIG.caip2,
    sponsored: !!sponsored,
  });

  console.log("Swap executed successfully.");
  console.log(
    `Tx: https://explorer.solana.com/tx/${signature}${MAINNET_CONFIG.explorerSuffix}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
