import * as dotenv from "dotenv";
import * as path from "path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import prompts from "prompts";

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  type TransactionInstruction,
  SystemProgram,
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

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  getSignatureFromActivity,
  type TActivity,
  getSignedTransactionFromActivity,
} from "@turnkey/http";
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import {
  createNewSolanaWallet,
  handleActivityError,
  solanaNetwork,
  signMessage,
  print,
} from "./utils";
import { createTransfer } from "./utils/createSolanaTransfer";

const TURNKEY_WAR_CHEST = "tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C";

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const defaultDestination = TURNKEY_WAR_CHEST;

  // Create a node connection; if no env var is found, default to public devnet RPC
  const nodeEndpoint =
    process.env.SOLANA_NODE || "https://api.devnet.solana.com";
  const connection = solanaNetwork.connect(nodeEndpoint);
  const network: "devnet" | "mainnet" = "devnet";

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

  // make the swig. TODO: use suborg id + wallet account pubkey (or some sort of unique combo)
  const id = new Uint8Array(32); // this should probably be tied to the suborg key / some identifier
  crypto.getRandomValues(id);

  const swigAddress = findSwigPda(id);

  await initSwig(
    connection,
    turnkeySigner,
    id,
    authorityKeyPubkey,
    payerKeyPubkey
  );

  console.log("init done");

  // now going to export the (Turnkey-hosted) sessionKey and payerKey... later...

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

  await sendTransaction(
    connection,
    turnkeySigner,
    payerKeyPubkey,
    sessionKeyPubkey,
    id,
    1,
    [
      SystemProgram.transfer({
        fromPubkey: swigAddress,
        toPubkey: new PublicKey(TURNKEY_WAR_CHEST),
        lamports: 1000, // for science
      }),
    ]
  );

  console.log("sent transaction!");

  process.exit(0);
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
  turnkeySigner: TurnkeySigner,
  payer: PublicKey, // this should be a KeyPair; do later with exported / raw private key
  session: PublicKey, // this should be a KeyPair; do later with exported / raw private key
  suborgId: Uint8Array,
  roleId: number,
  instructions: TransactionInstruction[]
) {
  const swigAddress = findSwigPda(suborgId); // this will not work
  const swig = await fetchSwig(connection, swigAddress);

  const swigInstructions = await getSignInstructions(
    swig,
    roleId,
    instructions,
    false,
    {
      payer,
    }
  );

  const transaction = new Transaction().add(...swigInstructions);
  transaction.recentBlockhash = await solanaNetwork.recentBlockhash(connection);
  transaction.feePayer = payer;

  // commenting out bc we're doing it the TK way for now
  // await sendAndConfirmTransaction(connection, transaction, [session]); // happens on client

  await turnkeySigner.addSignature(transaction, payer.toBase58());
  await turnkeySigner.addSignature(transaction, session.toBase58());

  let broadcastedTx = await solanaNetwork.broadcast(connection, transaction);

  console.log("send transaction from swig!", broadcastedTx);
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
