import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import prompts from "prompts";
import {
  createMessageSentEventAccount,
  getOrCreateRentPayerAccount,
  getTurnkeyClient,
  pollTransactionStatus,
} from "./turnkey";
import {
  formatUsdcAmount,
  lamportsToSol,
  parseUsdcAmount,
  sleep,
} from "./utils";

const SOURCE_DOMAIN = 5;
const DESTINATION_DOMAIN = 6;
const FAST_FINALITY_THRESHOLD = 1_000;
const FORWARDING_POLL_INTERVAL_MS = 5_000;
const FORWARDING_TIMEOUT_MS = 15 * 60_000;
const U64_MAX = 2n ** 64n - 1n;
const DEFAULT_CCTP_WALLET_NAME = "circle-cctp-message-accounts";
const DEFAULT_RENT_PAYER_WALLET_NAME = "circle-cctp-rent-payer";

const MESSAGE_TRANSMITTER_PROGRAM = new PublicKey(
  "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
);
const TOKEN_MESSENGER_MINTER_PROGRAM = new PublicKey(
  "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
);

const DEPOSIT_FOR_BURN_WITH_HOOK_DISCRIMINATOR = Buffer.from([
  111, 245, 62, 131, 204, 108, 223, 155,
]);
const FORWARDING_SERVICE_HOOK_DATA = Buffer.from(
  "636374702d666f72776172640000000000000000000000000000000000000000",
  "hex",
);

const SOLANA_NETWORKS = {
  mainnet: {
    rpc: "https://api.mainnet-beta.solana.com",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" as const,
    usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    circleApiBase: "https://iris-api.circle.com",
    solanaExplorerBase: "https://explorer.solana.com/tx",
    solanaExplorerSuffix: "",
    destinationName: "Base",
    destinationExplorerBase: "https://basescan.org/tx",
  },
  devnet: {
    rpc: "https://api.devnet.solana.com",
    caip2: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG" as const,
    usdcMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    circleApiBase: "https://iris-api-sandbox.circle.com",
    solanaExplorerBase: "https://explorer.solana.com/tx",
    solanaExplorerSuffix: "?cluster=devnet",
    destinationName: "Base Sepolia",
    destinationExplorerBase: "https://sepolia.basescan.org/tx",
  },
} as const;

type SolanaNetwork = keyof typeof SOLANA_NETWORKS;
type NetworkConfig = (typeof SOLANA_NETWORKS)[SolanaNetwork];

type FeeQuote = {
  finalityThreshold: number;
  minimumFee: number;
  forwardFee?: {
    low: number;
    med: number;
    high: number;
  };
};

type CircleMessageResponse = {
  messages?: Array<{
    status?: string;
    forwardState?: string;
    forwardTxHash?: string;
  }>;
};

function derivePda(
  programId: PublicKey,
  ...seeds: Array<Buffer | Uint8Array>
): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function encodeEvmAddress(address: string): Buffer {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(
      `Invalid DESTINATION_ADDRESS "${address}". Expected a 20-byte EVM address.`,
    );
  }

  return Buffer.concat([
    Buffer.alloc(12),
    Buffer.from(address.slice(2), "hex"),
  ]);
}

async function fetchForwardingQuote(
  network: NetworkConfig,
  transferAmount: bigint,
) {
  const url =
    `${network.circleApiBase}/v2/burn/USDC/fees/` +
    `${SOURCE_DOMAIN}/${DESTINATION_DOMAIN}?forward=true`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Circle fee request failed (${response.status}): ${await response.text()}`,
    );
  }

  const fees = (await response.json()) as FeeQuote[];
  const fastFee = fees.find(
    (fee) => fee.finalityThreshold === FAST_FINALITY_THRESHOLD,
  );
  if (!fastFee?.forwardFee) {
    throw new Error(
      "Circle returned no fast-transfer forwarding fee for this route.",
    );
  }
  if (!Number.isFinite(fastFee.minimumFee) || fastFee.minimumFee < 0) {
    throw new Error("Circle returned an invalid CCTP protocol fee.");
  }

  // minimumFee is quoted in basis points. Preserve two decimal places of bps,
  // matching Circle's documented fee calculation.
  const minimumFeeHundredthsOfBps = BigInt(
    Math.round(fastFee.minimumFee * 100),
  );
  const protocolFee = (transferAmount * minimumFeeHundredthsOfBps) / 1_000_000n;
  const forwardFee = BigInt(fastFee.forwardFee.med);
  const maxFee = protocolFee + forwardFee;
  const totalAmount = transferAmount + maxFee;

  if (totalAmount > U64_MAX) {
    throw new Error(
      "The transfer amount plus fees exceeds Solana CCTP's u64 limit.",
    );
  }

  return { forwardFee, maxFee, protocolFee, totalAmount };
}

function buildDepositForBurnInstruction({
  owner,
  eventRentPayer,
  messageSentEventAccount,
  mint,
  totalAmount,
  maxFee,
  destinationAddress,
}: {
  owner: PublicKey;
  eventRentPayer: PublicKey;
  messageSentEventAccount: PublicKey;
  mint: PublicKey;
  totalAmount: bigint;
  maxFee: bigint;
  destinationAddress: Buffer;
}): TransactionInstruction {
  const senderUsdcAccount = getAssociatedTokenAddressSync(mint, owner);
  const senderAuthority = derivePda(
    TOKEN_MESSENGER_MINTER_PROGRAM,
    Buffer.from("sender_authority"),
  );
  const denylistAccount = derivePda(
    TOKEN_MESSENGER_MINTER_PROGRAM,
    Buffer.from("denylist_account"),
    owner.toBuffer(),
  );
  const messageTransmitter = derivePda(
    MESSAGE_TRANSMITTER_PROGRAM,
    Buffer.from("message_transmitter"),
  );
  const tokenMessenger = derivePda(
    TOKEN_MESSENGER_MINTER_PROGRAM,
    Buffer.from("token_messenger"),
  );
  const remoteTokenMessenger = derivePda(
    TOKEN_MESSENGER_MINTER_PROGRAM,
    Buffer.from("remote_token_messenger"),
    Buffer.from(DESTINATION_DOMAIN.toString()),
  );
  const tokenMinter = derivePda(
    TOKEN_MESSENGER_MINTER_PROGRAM,
    Buffer.from("token_minter"),
  );
  const localToken = derivePda(
    TOKEN_MESSENGER_MINTER_PROGRAM,
    Buffer.from("local_token"),
    mint.toBuffer(),
  );
  const tokenMessengerEventAuthority = derivePda(
    TOKEN_MESSENGER_MINTER_PROGRAM,
    Buffer.from("__event_authority"),
  );
  const messageTransmitterEventAuthority = derivePda(
    MESSAGE_TRANSMITTER_PROGRAM,
    Buffer.from("__event_authority"),
  );

  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(totalAmount);
  const destinationDomainBuffer = Buffer.alloc(4);
  destinationDomainBuffer.writeUInt32LE(DESTINATION_DOMAIN);
  const maxFeeBuffer = Buffer.alloc(8);
  maxFeeBuffer.writeBigUInt64LE(maxFee);
  const finalityBuffer = Buffer.alloc(4);
  finalityBuffer.writeUInt32LE(FAST_FINALITY_THRESHOLD);
  const hookLengthBuffer = Buffer.alloc(4);
  hookLengthBuffer.writeUInt32LE(FORWARDING_SERVICE_HOOK_DATA.length);

  const data = Buffer.concat([
    DEPOSIT_FOR_BURN_WITH_HOOK_DISCRIMINATOR,
    amountBuffer,
    destinationDomainBuffer,
    destinationAddress,
    Buffer.alloc(32), // No restricted destination caller.
    maxFeeBuffer,
    finalityBuffer,
    hookLengthBuffer,
    FORWARDING_SERVICE_HOOK_DATA,
  ]);

  return new TransactionInstruction({
    programId: TOKEN_MESSENGER_MINTER_PROGRAM,
    keys: [
      // Circle TokenMessengerMinterV2 deposit_for_burn_with_hook account order:
      // owner, then event_rent_payer (must differ for the 3-signer Cash Lite shape).
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: eventRentPayer, isSigner: true, isWritable: true },
      { pubkey: senderAuthority, isSigner: false, isWritable: false },
      { pubkey: senderUsdcAccount, isSigner: false, isWritable: true },
      { pubkey: denylistAccount, isSigner: false, isWritable: false },
      { pubkey: messageTransmitter, isSigner: false, isWritable: true },
      { pubkey: tokenMessenger, isSigner: false, isWritable: false },
      { pubkey: remoteTokenMessenger, isSigner: false, isWritable: false },
      { pubkey: tokenMinter, isSigner: false, isWritable: false },
      { pubkey: localToken, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: messageSentEventAccount, isSigner: true, isWritable: true },
      {
        pubkey: MESSAGE_TRANSMITTER_PROGRAM,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: TOKEN_MESSENGER_MINTER_PROGRAM,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      {
        pubkey: tokenMessengerEventAuthority,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: TOKEN_MESSENGER_MINTER_PROGRAM,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: messageTransmitterEventAuthority,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: MESSAGE_TRANSMITTER_PROGRAM,
        isSigner: false,
        isWritable: false,
      },
    ],
    data,
  });
}

async function waitForForwardedMint(
  network: NetworkConfig,
  sourceSignature: string,
): Promise<string> {
  const url =
    `${network.circleApiBase}/v2/messages/${SOURCE_DOMAIN}` +
    `?transactionHash=${encodeURIComponent(sourceSignature)}`;
  const deadline = Date.now() + FORWARDING_TIMEOUT_MS;
  let lastState = "";

  console.log(
    `Waiting for Circle to mint USDC on ${network.destinationName}...`,
  );

  while (Date.now() < deadline) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const data = (await response.json()) as CircleMessageResponse;
      const message = data.messages?.[0];
      if (message?.forwardTxHash) {
        return message.forwardTxHash;
      }

      const state = message?.forwardState ?? message?.status ?? "pending";
      if (state !== lastState) {
        console.log(`Circle forwarding status: ${state}`);
        lastState = state;
      }
    } else if (response.status !== 404) {
      console.warn(
        `Circle message request returned ${response.status}; retrying...`,
      );
    }

    await sleep(FORWARDING_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Timed out waiting for the destination mint. The Solana burn succeeded; check ${url} for its forwarding status.`,
  );
}

async function main() {
  const organizationId = process.env.ORGANIZATION_ID?.trim();
  const signWith = process.env.SIGN_WITH?.trim();
  const cctpWalletName =
    process.env.CCTP_WALLET_NAME?.trim() || DEFAULT_CCTP_WALLET_NAME;
  const rentPayerWalletName =
    process.env.RENT_PAYER_WALLET_NAME?.trim() ||
    DEFAULT_RENT_PAYER_WALLET_NAME;
  const destination = process.env.DESTINATION_ADDRESS?.trim();
  const amountUsdc = process.env.AMOUNT_USDC?.trim();
  const networkEnv = (process.env.SOLANA_NETWORK ?? "devnet").toLowerCase();

  if (networkEnv !== "mainnet" && networkEnv !== "devnet") {
    throw new Error(
      `Invalid SOLANA_NETWORK "${networkEnv}". Must be "mainnet" or "devnet".`,
    );
  }
  if (!organizationId || !signWith || !destination || !amountUsdc) {
    throw new Error(
      "Missing required environment variables: ORGANIZATION_ID, SIGN_WITH, DESTINATION_ADDRESS, AMOUNT_USDC.",
    );
  }

  const network = SOLANA_NETWORKS[networkEnv as SolanaNetwork];
  const owner = new PublicKey(signWith);
  const mint = new PublicKey(network.usdcMint);
  const destinationAddress = encodeEvmAddress(destination);
  const transferAmount = parseUsdcAmount(amountUsdc);
  const connection = new Connection(network.rpc, "confirmed");

  const ownerUsdcAccount = getAssociatedTokenAddressSync(mint, owner);
  let usdcBalance: bigint;
  try {
    usdcBalance = (await getAccount(connection, ownerUsdcAccount)).amount;
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      throw new Error(
        `No USDC token account exists for SIGN_WITH ${signWith}.`,
      );
    }
    throw error;
  }

  const ownerSolBalance = await connection.getBalance(owner);
  const { forwardFee, maxFee, protocolFee, totalAmount } =
    await fetchForwardingQuote(network, transferAmount);

  if (usdcBalance < totalAmount) {
    throw new Error(
      `Insufficient USDC. Need ${formatUsdcAmount(totalAmount)} USDC including fees, but SIGN_WITH has ${formatUsdcAmount(usdcBalance)} USDC.`,
    );
  }

  console.log(`Solana network: ${networkEnv}`);
  console.log(`USDC owner: ${signWith}`);
  console.log(`CCTP event-signer wallet: ${cctpWalletName}`);
  console.log(`CCTP rent-payer wallet: ${rentPayerWalletName}`);
  console.log(`${network.destinationName} recipient: ${destination}`);
  console.log(`Owner SOL balance: ${lamportsToSol(ownerSolBalance)}`);
  console.log(`USDC balance: ${formatUsdcAmount(usdcBalance)}`);
  console.log(`Recipient amount: ${formatUsdcAmount(transferAmount)} USDC`);
  console.log(`CCTP protocol fee: ${formatUsdcAmount(protocolFee)} USDC`);
  console.log(`Circle forwarding fee: ${formatUsdcAmount(forwardFee)} USDC`);
  console.log(`Total burn: ${formatUsdcAmount(totalAmount)} USDC`);

  const { useSponsor } = await prompts({
    type: "confirm",
    name: "useSponsor",
    message:
      "Also use Turnkey Gas Station sponsorship (in addition to the dedicated rent payer)?",
    initial: true,
  });
  const sponsor = !!useSponsor;

  const { confirmed } = await prompts({
    type: "confirm",
    name: "confirmed",
    message:
      `Burn ${formatUsdcAmount(totalAmount)} USDC on Solana and deliver ` +
      `${formatUsdcAmount(transferAmount)} USDC to ${destination} on ${network.destinationName}?`,
    initial: false,
  });
  if (!confirmed) return;

  const turnkey = getTurnkeyClient();
  const apiClient = turnkey.apiClient();

  // Three Turnkey signers: rent payer (fee + MessageSent rent), USDC owner, and
  // a fresh MessageSent event account that must sign its own creation.
  const rentPayer = await getOrCreateRentPayerAccount({
    apiClient,
    organizationId,
    walletName: rentPayerWalletName,
  });
  if (rentPayer === signWith) {
    throw new Error(
      `Rent payer ${rentPayer} must be distinct from SIGN_WITH so this example exercises the 3-signer CCTP shape.`,
    );
  }

  const rentPayerSolBalance = await connection.getBalance(
    new PublicKey(rentPayer),
  );
  console.log(
    `Rent payer SOL balance: ${lamportsToSol(rentPayerSolBalance)}`,
  );
  if (!sponsor && rentPayerSolBalance === 0) {
    throw new Error(
      `Rent payer ${rentPayer} has no SOL. Prefund it for fees + MessageSent rent, or rerun with Turnkey sponsorship enabled.`,
    );
  }

  const eventSigner = await createMessageSentEventAccount({
    apiClient,
    organizationId,
    walletName: cctpWalletName,
  });
  const messageSentEventAccount = new PublicKey(eventSigner);
  const existingEventAccount = await connection.getAccountInfo(
    messageSentEventAccount,
  );
  if (existingEventAccount) {
    throw new Error(
      `New CCTP event signer ${eventSigner} unexpectedly already exists on-chain. Rerun the script to derive another account.`,
    );
  }
  console.log(`MessageSent event signer: ${eventSigner}`);
  console.log(`CCTP rent / fee payer: ${rentPayer}`);

  const eventRentPayer = new PublicKey(rentPayer);
  const instruction = buildDepositForBurnInstruction({
    owner,
    eventRentPayer,
    messageSentEventAccount,
    mint,
    totalAmount,
    maxFee,
    destinationAddress,
  });
  const { blockhash } = await connection.getLatestBlockhash();
  const txMessage = new TransactionMessage({
    // Fee payer is the dedicated rent payer so SIGN_WITH can stay SOL-less.
    payerKey: eventRentPayer,
    recentBlockhash: blockhash,
    instructions: [instruction],
  });
  const versionedTx = new VersionedTransaction(txMessage.compileToV0Message());

  if (versionedTx.message.header.numRequiredSignatures !== 3) {
    throw new Error(
      `Expected exactly 3 transaction signatures, found ${versionedTx.message.header.numRequiredSignatures}.`,
    );
  }

  const unsignedTransaction = Buffer.from(versionedTx.serialize()).toString(
    "hex",
  );
  // Ordered to match the compiled message: fee/rent payer, USDC owner, event account.
  const signWiths = [rentPayer, signWith, eventSigner];

  console.log(`signWiths: [${signWiths.join(", ")}]`);
  const { sendTransactionStatusId } = await apiClient.solSendTransactionV2({
    organizationId,
    unsignedTransaction,
    signWiths,
    caip2: network.caip2,
    sponsor,
  });

  const status = await pollTransactionStatus({
    apiClient,
    organizationId,
    sendTransactionStatusId,
  });
  if (status.txStatus !== "INCLUDED" && status.txStatus !== "COMPLETED") {
    throw new Error(`CCTP burn failed with status: ${status.txStatus}`);
  }

  const sourceSignature = status.solana?.signature;
  if (!sourceSignature) {
    throw new Error(
      `Missing Solana transaction signature (status: ${status.txStatus}).`,
    );
  }

  console.log(
    `Solana burn: ${network.solanaExplorerBase}/${sourceSignature}${network.solanaExplorerSuffix}`,
  );
  const destinationHash = await waitForForwardedMint(network, sourceSignature);
  console.log(
    `${network.destinationName} mint: ${network.destinationExplorerBase}/${destinationHash}`,
  );
  console.log("CCTP transfer complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
