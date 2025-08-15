import * as dotenv from "dotenv";
import * as path from "path";
import bs58 from "bs58";

import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  AccountMeta,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPda,
  getCreateSwigInstruction,
  fetchSwig,
  getAddAuthorityInstructions,
  createEd25519SessionAuthorityInfo,
  getCreateSessionInstructions,
  getSignInstructions,
} from "@swig-wallet/classic";

import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

import { createJupiterApiClient } from "@jup-ag/api";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { generateP256KeyPair, decryptExportBundle } from "@turnkey/crypto";
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import { solanaNetwork } from "./utils";

const TURNKEY_WAR_CHEST = "tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C";

function formatNumber(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function toTransactionInstruction(instruction: any): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((k: any) => ({
      pubkey: new PublicKey(k.pubkey),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: Buffer.from(instruction.data, "base64"),
  });
}

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;

  // Create a node connection; if no env var is found, default to public devnet RPC
  const nodeEndpoint =
    process.env.SOLANA_NODE || "https://api.mainnet-beta.solana.com"; // api.devnet for testnet
  const connection = solanaNetwork.connect(nodeEndpoint);
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

  const authorityKeyAddress = process.env.AUTHORITY_KEY_ADDRESS!;
  const sessionKeyAddress = process.env.SESSION_KEY_ADDRESS!; // this will exist in the client-side in the future
  const payerKeyAddress = process.env.PAYER_KEY_ADDRESS!; // will fund gas; will figure out details later

  const authorityKeyPubkey = new PublicKey(authorityKeyAddress);
  const sessionKeyPubkey = new PublicKey(sessionKeyAddress); // deal with this later
  const payerKeyPubkey = new PublicKey(payerKeyAddress);

  // 1. Create Swig: this will funded by customer (UX-wise, they can "protect" this from being abused by only funding/creating these once ....... figure this out later). Creative option: customer deposits WSOL --> we can create an ATA for this for the swig and then have swig unwrap

  const exportedSessionKey = await exportWalletAccount(
    turnkeyClient,
    sessionKeyAddress
  );
  const exportedPayerKey = await exportWalletAccount(
    turnkeyClient,
    payerKeyAddress
  );

  const generatedKeypair = Keypair.generate();
  console.log("generated", generatedKeypair);

  console.log("session key buffer", Buffer.from(exportedSessionKey));
  console.log(
    "session key buffer length",
    Buffer.from(exportedSessionKey).length
  );
  console.log("payer key buffer", Buffer.from(exportedPayerKey));
  console.log("payer key buffer length", Buffer.from(exportedPayerKey).length);

  const sessionKeypair = Keypair.fromSecretKey(bs58.decode(exportedSessionKey));
  const payerKeypair = Keypair.fromSecretKey(bs58.decode(exportedPayerKey));

  console.log({
    sessionKeypair,
    payerKeypair,
  });

  // make the swig. TODO: use suborg id + wallet account pubkey (or some sort of unique combo)
  // const id = new Uint8Array(32); // this should probably be tied to the suborg key / some identifier
  // crypto.getRandomValues(id);

  // const id = new Uint8Array([
  //   30, 242, 23, 252, 248, 75, 167, 107, 138, 148, 215, 162, 55, 116, 18, 118,
  //   237, 138, 224, 136, 116, 93, 117, 227, 101, 211, 220, 1, 31, 75, 213, 244,
  // ]); // devnet

  const id = new Uint8Array([
    99, 160, 74, 1, 30, 40, 235, 121, 100, 102, 152, 156, 210, 244, 41, 91, 35,
    174, 128, 56, 133, 252, 54, 31, 75, 4, 57, 82, 38, 71, 107, 114,
  ]); // mainnet

  // const swigAddress = findSwigPda(id); // CbC4eWVVKCsBHoHWunKk9NDrdnq9a8JKbr6bqPRoVNQR for devnet
  const swigAddress = findSwigPda(id); // GpSVLf8XCWRfStnQBrpwZ45PdDQfLgvpq9ut7RGCKmkH for mainnet

  // await initSwig(
  //   connection,
  //   turnkeySigner,
  //   id,
  //   authorityKeyPubkey,
  //   payerKeyPubkey
  // );

  // console.log("init done");

  // note: this may lead to a race condition if the swig isn't "ready" by the time we're trying to set the session
  await setSession(
    connection,
    turnkeySigner,
    authorityKeyPubkey, // aka treasurer
    payerKeyPubkey,
    sessionKeyPubkey,
    1000n,
    id,
    1
  );

  console.log("set session!");

  // await sendTransaction(connection, payerKeypair, sessionKeypair, id, 1, [
  //   SystemProgram.transfer({
  //     fromPubkey: swigAddress,
  //     // toPubkey: new PublicKey(TURNKEY_WAR_CHEST),
  //     toPubkey: new PublicKey("ENfc2wGWVfbNTda1eMQ6zFFHQYQoBGedxrRpTVY7cejm"),
  //     lamports: LAMPORTS_PER_SOL * 0.001, // for science
  //   }),
  // ]);

  // console.log("sent transaction!");

  await swapWithJupiter(
    connection,
    swigAddress,
    // authorityKeyPubkey,
    payerKeypair,
    sessionKeypair
  );

  console.log("swapped with jupiter!");

  process.exit(0);
}

async function exportWalletAccount(turnkeyClient: Turnkey, address: string) {
  const keyPair = generateP256KeyPair();
  const privateKey = keyPair.privateKey;
  const publicKey = keyPair.publicKeyUncompressed;

  const exportResult = await turnkeyClient.apiClient().exportWalletAccount({
    address,
    targetPublicKey: publicKey,
  });

  const decryptedBundle = await decryptExportBundle({
    exportBundle: exportResult.exportBundle,
    embeddedKey: privateKey,
    organizationId: turnkeyClient.config.defaultOrganizationId,
    returnMnemonic: false,
    keyFormat: "SOLANA",
    dangerouslyOverrideSignerPublicKey:
      "04f3422b8afbe425d6ece77b8d2469954715a2ff273ab7ac89f1ed70e0a9325eaa1698b4351fd1b23734e65c0b6a86b62dd49d70b37c94606aac402cbd84353212", // for preprod
  });

  // WARNING: Be VERY careful how you handle this bundle, this can be use to import your private keys/mnemonics anywhere and can lead to a potential loss of funds
  console.log("decrypted bundle: ", decryptedBundle);

  return decryptedBundle;
}

/* Init
  1. Create the swig - swig starts with giving the suborg key the root role (role 0)
  2. Add a new role (add authority) that only provides non-managment (trading) functions to the suborg key (role 1)
  tbd, on create the suborg key adds a global off switch call back
*/

async function initSwig(
  connection: Connection,
  turnkeySigner: TurnkeySigner,
  suborgId: Uint8Array, // suborg Id --> needs to be a Buffer
  treasurer: PublicKey, // todo - generate and sign inside TK enclave
  payer: PublicKey // todo - use TK enclave
) {
  const swigAddress = findSwigPda(suborgId);
  const rootAuthorityInfo = createEd25519AuthorityInfo(treasurer); // this is the end-user suborg wallet key (for now)
  const rootActions = Actions.set().manageAuthority().get(); // TODO: investigate manageAuthority

  const createSwigIx = await getCreateSwigInstruction({
    payer,
    id: suborgId,
    actions: rootActions,
    authorityInfo: rootAuthorityInfo,
  });

  const transaction = new Transaction().add(createSwigIx);
  transaction.recentBlockhash = await solanaNetwork.recentBlockhash(connection);
  transaction.feePayer = payer;

  // sign transaction using @turnkey/solana
  // await turnkeySigner.addSignature(transaction, treasurer.toBase58()); // doesn't return anything; adds signature in place
  await turnkeySigner.addSignature(transaction, payer.toBase58()); // same here

  let broadcastedTx = await solanaNetwork.broadcast(connection, transaction);

  console.log("swig created!", broadcastedTx);

  // make the role
  const allButManageActions = Actions.set().allButManageAuthority().get();
  const swig = await fetchSwig(connection, swigAddress);
  const addAuthorityInstructions = await getAddAuthorityInstructions(
    swig,
    0, // iterate new role id
    createEd25519SessionAuthorityInfo(treasurer, 1000n), // giving a second role to the treasurer; can add session key here
    allButManageActions, // set all but manage
    {
      payer,
    }
  );

  const addAuthorityTx = new Transaction().add(...addAuthorityInstructions);
  addAuthorityTx.recentBlockhash =
    await solanaNetwork.recentBlockhash(connection);
  addAuthorityTx.feePayer = payer;

  // sign transaction using @turnkey/solana
  await turnkeySigner.addSignature(addAuthorityTx, payer.toBase58()); // same here
  await turnkeySigner.addSignature(addAuthorityTx, treasurer.toBase58()); // doesn't return anything; adds signature in place

  broadcastedTx = await solanaNetwork.broadcast(connection, addAuthorityTx);

  console.log("added authority to swigggggity!", broadcastedTx);

  console.log("swig details", {
    suborgId,
    swigAddress,
    swig,
  });
}

/* Set session - login or extend
  1. Call create session with the non-mangement role (role 1) and broadcast 
*/

async function setSession(
  connection: Connection,
  turnkeySigner: TurnkeySigner,
  treasurer: PublicKey,
  payer: PublicKey, // do later
  session: PublicKey,
  timeout: bigint,
  suborgId: Uint8Array,
  roleId: number
) {
  const swigAddress = findSwigPda(suborgId); // this will not work
  const swig = await fetchSwig(connection, swigAddress);

  const createSessionIx = await getCreateSessionInstructions(
    swig,
    roleId,
    session,
    timeout,
    {
      payer,
    }
  );

  const transaction = new Transaction().add(...createSessionIx);
  transaction.recentBlockhash = await solanaNetwork.recentBlockhash(connection);
  transaction.feePayer = payer;

  // sign transaction using @turnkey/solana
  // await turnkeySigner.addSignature(transaction, treasurer.toBase58()); // doesn't return anything; adds signature in place
  await turnkeySigner.addSignature(transaction, payer.toBase58());
  await turnkeySigner.addSignature(transaction, treasurer.toBase58());

  let broadcastedTx = await solanaNetwork.broadcast(connection, transaction);

  console.log("session set!", broadcastedTx);
  console.log("session details", createSessionIx);
}

/* Send transaction
  Call normal send transaction via swig
    Initiated by payer (can be session key)
    Signed by by session
*/

async function sendTransaction(
  connection: Connection,
  payer: Keypair,
  session: Keypair,
  suborgId: Uint8Array,
  roleId: number,
  instructions: TransactionInstruction[]
) {
  const swigAddress = findSwigPda(suborgId); // this will not work
  const swig = await fetchSwig(connection, swigAddress);

  console.log("sending to swig address", swigAddress);

  const swigInstructions = await getSignInstructions(
    swig,
    roleId,
    instructions,
    false,
    {
      payer: payer.publicKey,
    }
  );

  const transaction = new Transaction().add(...swigInstructions);
  transaction.recentBlockhash = await solanaNetwork.recentBlockhash(connection);
  transaction.feePayer = payer.publicKey;

  const signature = await sendAndConfirmTransaction(connection, transaction, [
    payer,
    session,
  ]);
  console.log("SIGNATURE", signature);

  // let broadcastedTx = await solanaNetwork.broadcast(connection, transaction);

  console.log("send transaction from swig!", signature);
}

// hardcoded to swap USDC <> WSOL for now
// 1. create USDC ATA
// 2. create WSOL ATA
// 3.
async function swapWithJupiter(
  connection: Connection,
  swigAddress: PublicKey,
  // treasurer: PublicKey, // authority
  payer: Keypair, // Turnkey address to get exported every time; we're comfortable exporting this one
  session: Keypair
) {
  const usdcMint = new PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  ); // mainnet
  // const usdcMint = new PublicKey(
  //   "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
  // ); // devnet, apparently
  const wrappedSolMint = new PublicKey(
    "So11111111111111111111111111111111111111112"
  );

  const swigUsdcAta = await getAssociatedTokenAddress(
    usdcMint,
    swigAddress,
    true
  );
  try {
    await getAccount(connection, swigUsdcAta);
    console.log("✓ USDC ATA exists:", swigUsdcAta.toBase58());
  } catch {
    const createAtaIx = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      swigUsdcAta,
      swigAddress,
      usdcMint
    );

    // need to sign and send using Turnkey client because that's where the authority lives
    // NOT the session or payer key
    // const transaction = new Transaction().add(createAtaIx);
    // transaction.recentBlockhash =
    //   await solanaNetwork.recentBlockhash(connection);
    // transaction.feePayer = payer.publicKey;

    // await turnkeySigner.addSignature(transaction, treasurer.toBase58());
    // transaction.sign([payer]);
    // const broadcastedTx = await solanaNetwork.broadcast(
    //   connection,
    //   transaction
    // );

    const transaction = new Transaction().add(createAtaIx);
    transaction.recentBlockhash =
      await solanaNetwork.recentBlockhash(connection);
    transaction.feePayer = payer.publicKey;

    const signature = await sendAndConfirmTransaction(connection, transaction, [
      payer,
      // session,
    ]);

    console.log("✓ Created USDC ATA:", swigUsdcAta.toBase58());
    console.log("broadcasted tx:", signature);
  }

  const swigWrappedSolAta = await getAssociatedTokenAddress(
    wrappedSolMint,
    swigAddress,
    true
  );
  try {
    await getAccount(connection, swigWrappedSolAta);
    console.log("✓ Wrapped SOL ATA exists:", swigWrappedSolAta.toBase58());
  } catch {
    const createAtaIx = createAssociatedTokenAccountInstruction(
      // treasurer,
      payer.publicKey,
      swigWrappedSolAta,
      swigAddress,
      wrappedSolMint
    );

    // need to sign and send using Turnkey client because that's where the authority lives.
    // alternatively, the session key can do this (maybe). need to test
    // const transaction = new Transaction().add(createAtaIx);
    // transaction.recentBlockhash =
    //   await solanaNetwork.recentBlockhash(connection);
    // transaction.feePayer = payer.publicKey;

    // await turnkeySigner.addSignature(transaction, treasurer.toBase58());
    // const broadcastedTx = await solanaNetwork.broadcast(
    //   connection,
    //   transaction
    // );

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: [createAtaIx],
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);
    // tx.sign([payer, session]); // fee payer and session key need to sign
    tx.sign([payer]); // fee payer and session key need to sign

    const signature = await connection.sendTransaction(tx, {
      skipPreflight: true,
      preflightCommitment: "confirmed",
    });

    const result = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log("✓ Created Wrapped SOL ATA:", swigWrappedSolAta.toBase58());
    console.log("broadcasted tx:", result);
  }

  const transferAmount = 0.001 * LAMPORTS_PER_SOL;

  // seed the swig with some funds; can come from anywhere
  // TODO: fix all this
  // not doing this for now because I don't think we need it
  //
  // const transferTx = new Transaction().add(
  //   SystemProgram.transfer({
  //     fromPubkey: treasurer,
  //     toPubkey: swigAddress,
  //     lamports: transferAmount,
  //   })
  // );
  // await sendAndConfirmTransaction(connection, transferTx, [rootUser]);
  // console.log("✓ Transferred 0.01 SOL to Swig");

  const jupiter = createJupiterApiClient();
  const quote = await jupiter.quoteGet({
    inputMint: wrappedSolMint.toBase58(),
    outputMint: usdcMint.toBase58(),
    amount: Math.floor(transferAmount),
    slippageBps: 100,
    maxAccounts: 64,
  });

  if (!quote) {
    console.log("❌ No quote available");
    return;
  }

  console.log("📊 Quote received:");
  console.log(`   Input: ${formatNumber(Number(quote.inAmount))} lamports`);
  console.log(`   Output: ${formatNumber(Number(quote.outAmount))} USDC (raw)`);

  const swapInstructionsRes = await jupiter.swapInstructionsPost({
    swapRequest: {
      quoteResponse: quote,
      userPublicKey: swigAddress.toBase58(),
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
      // additional flags
      // dynamicComputeUnitLimit: true,
      // prioritizationFeeLamports: {
      //   jitoTipLamports: 1000
      // }
    },
  });

  const swig = await fetchSwig(connection, swigAddress);

  const swapInstructions: TransactionInstruction[] = [
    ...(swapInstructionsRes.setupInstructions || []).map(
      toTransactionInstruction
    ),
    toTransactionInstruction(swapInstructionsRes.swapInstruction),
  ];

  swapInstructions[1]?.keys.push({
    pubkey: new PublicKey(swig.address.toAddress()),
    isSigner: false,
    isWritable: false,
  } as AccountMeta);

  console.log("setup instructions", swapInstructionsRes.setupInstructions);
  console.log("swap instructions", JSON.stringify(swapInstructions));

  // const rootRole = swig.findRolesByEd25519SignerPk(rootUser.publicKey)[0];
  const signIxs = await getSignInstructions(
    swig,
    // rootRole.id,
    1, // session key role
    swapInstructions
  );

  const lookupTables = await Promise.all(
    swapInstructionsRes.addressLookupTableAddresses.map(async (addr) => {
      const res = await connection.getAddressLookupTable(new PublicKey(addr));
      return res.value!;
    })
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  const outerIxs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 150 }),
  ];

  // perform swap from WSOL to USDC
  // this can be signed for by the session key
  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [...outerIxs, ...signIxs],
  }).compileToV0Message(lookupTables);

  const tx = new VersionedTransaction(messageV0);
  tx.sign([payer, session]); // fee payer and session key need to sign

  const signature = await connection.sendTransaction(tx, {
    skipPreflight: true,
    preflightCommitment: "confirmed",
  });

  const result = await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  if (result.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  }

  const postSwapBalance = await connection.getTokenAccountBalance(swigUsdcAta);
  console.log("🎉 Swap successful!");
  console.log(`   Signature: ${signature}`);
  console.log(`💰 New USDC balance: ${postSwapBalance.value.uiAmount}`);
}

/// OLD STUFF ///

// async function createSwigAccount(connection: Connection,
//   user: Keypair,
//   sessionKey : string
// ) {
//   try {
//     const id = new Uint8Array(32); // this should probably be tied to the suborg key / some identifier
//     crypto.getRandomValues(id);
//     const swigAddress = findSwigPda(id);
//     const rootAuthorityInfo = createEd25519AuthorityInfo(user.publicKey); // this is the end-user suborg wallet key (for now)
//     const rootActions = Actions.set().manageAuthority().get(); // TODO: investigate manageAuthority

//     const createSwigIx = await getCreateSwigInstruction({
//       payer: user.publicKey,
//       id,
//       actions: rootActions,
//       authorityInfo: rootAuthorityInfo,
//     });

//     // const addAuthorityInstructions = await getAddAuthorityInstructions(
//     //   swig,
//     //   0,
//     //   createEd25519SessionAuthorityInfo(user.publicKey), // in-browser session key
//     //   actions // set all but maanage
//     // );
//     const transaction = new Transaction().add(createSwigIx);//.add(addAuthorityInstructions);
//     const signature = await sendAndConfirmTransaction(connection, transaction, [
//       user,
//     ]);

//     console.log("✓ Swig account created at:", swigAddress.toBase58());
//     console.log("Transaction signature:", signature);
//     return swigAddress;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// async function createSession(){
//     const createSessionIx = await getCreateSessionInstructions(
//       swig,
//       1, // rootRole.id,
//       sessionKey// dappSessionKeypair.publicKey,
//       50n,
//     );
// );

// await sendTransaction(connection, createSessionIx, userRootKeypair);
// }

// async function addNewAuthority(
//   connection: Connection,
//   rootUser: Keypair, // end-user suborg key - can be pubkey
//   newAuthority: Keypair, // session key - can be pubkey
//   swigAddress: PublicKey,
//   actions: any, // set the power level in the actions - all but manage
//   description: string
// ) {
//   try {
//     const swig = await fetchSwig(connection, swigAddress);

//     const rootRole = swig.findRolesByEd25519SignerPk(rootUser.publicKey)[0];
//     if (!rootRole) {
//       throw new Error("Root role not found for authority");
//     }

//     const transaction = new Transaction().add(...addAuthorityInstructions);
//     await sendAndConfirmTransaction(connection, transaction, [rootUser]);
//     console.log(
//       "done"
//       // chalk.green(`✓ New ${description} authority added:`),
//       // chalk.cyan(newAuthority.publicKey.toBase58())
//     );
//   } catch (error) {
//     console.error(
//       "error"
//       // chalk.red(`✗ Error adding ${description} authority:`),
//       // chalk.red(error)
//     );
//     throw error;
//   }
// }

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
