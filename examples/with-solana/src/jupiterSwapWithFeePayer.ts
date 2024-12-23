import * as dotenv from "dotenv";
import * as path from "path";

import {
  Connection,
  VersionedTransaction,
  TransactionMessage,
  PublicKey,
  AddressLookupTableAccount,
  LoadedAddresses,
} from "@solana/web3.js";
import fetch from "cross-fetch";

import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";

import {
  createNewSolanaWallet,
  print,
  transactionSenderAndConfirmationWaiter,
} from "./utils";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const createSwap = async () => {
  const organizationId = process.env.ORGANIZATION_ID!;

  // It is recommended that you use your own RPC endpoint.
  // This RPC endpoint is only for demonstration purposes so that this example will run.
  const connection = new Connection(
    process.env.SOLANA_NODE ??
      "https://neat-hidden-sanctuary.solana-mainnet.discover.quiknode.pro/2af5315d336f9ae920028bbb90a73b724dc1bbed/"
  );

  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  const turnkeySigner = new TurnkeySigner({
    organizationId,
    client: turnkeyClient.apiClient(),
  });

  let solAddress = process.env.SOLANA_ADDRESS!;
  if (!solAddress) {
    solAddress = await createNewSolanaWallet(turnkeyClient.apiClient());
    console.log(`\nYour new Solana address: "${solAddress}"`);
  } else {
    console.log(`\nUsing existing Solana address from ENV: "${solAddress}"`);
  }

  let feePayerAddress = process.env.SOLANA_ADDRESS_FEE_PAYER!;
  if (!feePayerAddress) {
    feePayerAddress = await createNewSolanaWallet(turnkeyClient.apiClient());
    console.log(`\nYour new Solana address: "${feePayerAddress}"`);
  } else {
    console.log(
      `\nUsing existing Solana address from ENV: "${feePayerAddress}"`
    );
  }

  const payerKey = new PublicKey(feePayerAddress);

  // Swapping SOL to USDC with input 0.01 SOL and 1% slippage
  // See example here: https://station.jup.ag/docs/apis/swap-api
  const quoteResponse = await (
    await fetch(
      "https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112\
&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v\
&amount=10000000\
&slippageBps=100"
    )
  ).json();

  // get serialized transactions for the swap
  const { swapTransaction } = await (
    await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // quoteResponse from /quote api
        quoteResponse,
        // user public key to be used for the swap
        userPublicKey: solAddress,
        // auto wrap and unwrap SOL. default is true
        wrapAndUnwrapSol: true,
        // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
        // feeAccount: "fee_account_public_key"
        dynamicComputeUnitLimit: true, // allow dynamic compute limit instead of max 1,400,000
        // custom priority fee
        prioritizationFeeLamports: "auto", // or custom lamports: 1000
      }),
    })
  ).json();

  // deserialize the transaction
  const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
  const swapTransactionHex = swapTransactionBuf.toString("hex");
  let transaction = VersionedTransaction.deserialize(swapTransactionBuf);

  const LUTs = (
    await Promise.all(
      transaction.message.addressTableLookups.map((acc) =>
        connection.getAddressLookupTable(acc.accountKey)
      )
    )
  )
    .map((lut) => lut.value)
    .filter((val) => val !== null) as AddressLookupTableAccount[];
    
//   const allAccs = transaction.message
    // .getAccountKeys({ addressLookupTableAccounts: LUTs })
    // .keySegments()
    // .reduce((acc, cur) => acc.concat(cur), []);

    // console.log({allAccs})

  let txMessage = TransactionMessage.decompile(transaction.message, {
    addressLookupTableAccounts: LUTs
  });
  txMessage.payerKey = payerKey;

  //   let newTxMessage : TransactionMessage = {
  //     ...txMessage,
  //     payerKey: payerKey
  //   };

  let newTxMessage = new TransactionMessage({
    ...txMessage,
    payerKey,
  });

  let newTransaction = new VersionedTransaction(
    newTxMessage.compileToV0Message()
  );

  console.log({
    newTxMessage,
    newTransaction
  })

  // sign the transaction
  const signedTransaction = await turnkeySigner.signTransaction(
    newTransaction,
    solAddress
  );

  // get the latest block hash
  const latestBlockHash = await connection.getLatestBlockhash();

  // Execute the transaction
  const rawTransaction = signedTransaction.serialize();

  const transactionResponse = await transactionSenderAndConfirmationWaiter({
    connection,
    serializedTransaction: Buffer.from(rawTransaction),
    blockhashWithExpiryBlockHeight: latestBlockHash,
  });

  print(
    "Transaction signed ✨",
    `https://solscan.io/tx/${transactionResponse?.transaction.signatures[0]}`
  );
  print("Unsigned payload", swapTransactionHex);
};

createSwap();
