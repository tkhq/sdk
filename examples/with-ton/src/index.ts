import * as dotenv from "dotenv";
import * as path from "path";
import {
  TonClient,
  Address,
  beginCell,
  WalletContractV4,
  internal,
  storeMessageRelaxed,
  SendMode,
  Cell,
  storeMessage,
  external,
} from "@ton/ton";
import { input } from "@inquirer/prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { bytesToHex } from "@noble/hashes/utils";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function createWalletTransferV4WithTurnkey(args: {
  seqno: number;
  sendMode: number;
  walletId: number;
  messages: any[];
  turnkeyClient: Turnkey;
  walletAddress: string;
}) {
  // Check number of messages
  if (args.messages.length > 4) {
    throw Error("Maximum number of messages in a single transfer is 4");
  }

  let signingMessageBuilder = beginCell().storeUint(args.walletId, 32);

  if (args.seqno === 0) {
    for (let i = 0; i < 32; i++) {
      signingMessageBuilder.storeBit(1); // Initial state for uninitialized wallet
    }
  } else {
    signingMessageBuilder.storeUint(Math.floor(Date.now() / 1e3) + 60, 32); // Default timeout: 60 seconds
  }

  signingMessageBuilder.storeUint(args.seqno, 32);
  signingMessageBuilder.storeUint(0, 8); // Simple order
  for (let m of args.messages) {
    signingMessageBuilder.storeUint(args.sendMode, 8);
    signingMessageBuilder.storeRef(beginCell().store(storeMessageRelaxed(m)));
  }

  const signingMessage = signingMessageBuilder.endCell().hash();

  // Sign message using Turnkey
  const txSignResult = await args.turnkeyClient.apiClient().signRawPayload({
    signWith: args.walletAddress,
    payload: bytesToHex(signingMessage),
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
  });

  const { r, s } = txSignResult;
  const signatureBytes = Buffer.from(r + s, "hex");
  const body = beginCell()
    .storeBuffer(signatureBytes)
    .storeBuilder(signingMessageBuilder)
    .endCell();
  return body;
}

async function externalTransaction(
  client: TonClient,
  address: Address,
  init: { code: Cell | null; data: Cell | null } | null,
  body: Cell
) {
  // Check if the contract needs initialization (init code/data)
  let neededInit: { code: Cell | null; data: Cell | null } | null = null;
  if (init && !(await client.isContractDeployed(address))) {
    neededInit = init;
  }

  // Create the external message
  const ext = external({
    to: address,
    init: neededInit ? { code: neededInit.code, data: neededInit.data } : null,
    body: body,
  });

  // Build the final message to send
  const boc = beginCell().store(storeMessage(ext)).endCell().toBoc();

  // Send the transaction
  await client.sendFile(boc);
}

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  const client = new TonClient({
    endpoint: process.env.TON_RPC_URL!,
    apiKey: process.env.TON_API_KEY!,
  });
  const walletAddress = process.env.TON_ADDRESS!;
  const walletPublicKey = process.env.TON_PUBLIC_KEY!;

  if (!walletAddress || !walletPublicKey) {
    throw new Error(
      "Please set your TON_ADDRESS and TON_PUBLIC_KEY in the .env.local file."
    );
  }

  console.log(`Using TON address: ${walletAddress}`);

  const tonAddress = Address.parse(walletAddress);
  let accountData;
  try {
    accountData = await client.getBalance(tonAddress);
  } catch (error) {
    throw new Error(
      `Failed to retrieve balance for address ${tonAddress}: ${error}`
    );
  }
  if (!accountData || BigInt(accountData) === 0n) {
    console.log(
      `Your account does not exist or has zero balance. Fund your address ${walletAddress} to proceed.`
    );
    process.exit(1);
  }

  const recipientAddress = await input({
    message: "Recipient address:",
    default: "<recipient_ton_address>",
  });

  console.log(`\nSending 0.015 TON to ${recipientAddress}`);

  const tonWallet = WalletContractV4.create({
    workchain: 0,
    publicKey: Buffer.from(walletPublicKey, "hex"),
  });

  const opened = client.open(tonWallet);
  const seqno = await opened.getSeqno();
  const message = internal({
    value: "0.015",
    to: recipientAddress,
    body: "Transfer body",
  });

  const body = await createWalletTransferV4WithTurnkey({
    seqno,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    walletId: tonWallet.walletId,
    messages: [message],
    turnkeyClient,
    walletAddress,
  });

  // Check if the wallet is deployed, if not provide init data
  const init =
    opened.init && !(await client.isContractDeployed(tonAddress))
      ? opened.init
      : null;

  // Send the transaction using the external transaction logic
  externalTransaction(client, tonAddress, init, body);

  console.log("Transaction sent successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
