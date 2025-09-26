import * as path from "path";
import * as dotenv from "dotenv";
import {
  createClient,
  createPublicClient,
  http,
  createWalletClient,
  custom,
  LocalAccount,
  parseEther,
} from "viem";
import { sepolia } from "viem/chains";
import { Porto } from "porto";
import { RelayActions, Key } from "porto/viem";

import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (
  !process.env.SIGN_WITH ||
  !process.env.BASE_URL ||
  !process.env.API_PRIVATE_KEY ||
  !process.env.API_PUBLIC_KEY ||
  !process.env.ORGANIZATION_ID ||
  !process.env.RPC_URL
) {
  throw new Error(
    "Missing environment variables. Please check your .env.local file for SIGN_WITH, BASE_URL, API_PRIVATE_KEY, API_PUBLIC_KEY, ORGANIZATION_ID, and RPC_URL."
  );
}

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: process.env.BASE_URL,
  apiPrivateKey: process.env.API_PRIVATE_KEY,
  apiPublicKey: process.env.API_PUBLIC_KEY,
  defaultOrganizationId: process.env.ORGANIZATION_ID,
});

const debug = (...args: any[]) => {
  console.log("[*]", ...args);
};

async function main() {
  // Turnkey setup
  const signWith = process.env.SIGN_WITH!;  
  const turnkeyEoa = await createAccount({  
    client: turnkeyClient.apiClient(),  
    organizationId: process.env.ORGANIZATION_ID!,  
    signWith: signWith,  
  });  
    
  // Create Porto client  
  const client = createClient({  
    chain: sepolia, // or your target chain  
    transport: http('https://rpc.porto.sh')  
  })  
    
  // Create admin key for the upgraded account  
  const adminKey = Key.createSecp256k1({ role: 'admin' })  
    
  debug(`Turnkey EOA address: ${turnkeyEoa.address}`);

  /** Upgrade the EOA wallet */

  // Step 1: Prepare the upgrade
  debug("Preparing to upgrade EOA to a Porto wallet...");
  const { digests, ...request } = await RelayActions.prepareUpgradeAccount(client, {  
    address: turnkeyEoa.address,  
    authorizeKeys: [adminKey],  
    chain: sepolia,
  })  

  // Assert that turnkeyEoa has a sign function before proceeding
  if (!turnkeyEoa.sign || typeof turnkeyEoa.sign !== 'function') {
    throw new Error('Turnkey EOA account must have a sign function');
  }

  // Step 2: Sign with your Turnkey EOA
  debug("Upgrade prepared. Signing transaction...");
  const signatures = {  
    auth: await turnkeyEoa.sign({ hash: digests.auth }),  
    exec: await turnkeyEoa.sign({ hash: digests.exec }),  
  }  
    
  // Step 3: Complete the upgrade
  debug("Executing upgrade transaction...");
  const portoAccount = await RelayActions.upgradeAccount(client, {  
    ...request,  
    signatures,  
  })

  debug("Account successfully upgraded!");

  /** Interact with the upgraded Porto wallet */

  const userOpHash = await RelayActions.sendCalls(client, {
    account: portoAccount,
    calls: [{ 
      to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 
      value: parseEther('0.01'), 
    }],
    chain: sepolia,
    key: adminKey,
  })

  debug(`User operation sent: ${userOpHash}`);
  debug(
    `See details at https://jiffyscan.xyz/userOpHash/${userOpHash}?network=sepolia`
  );
}

// async function main() {
//   const signWith = process.env.SIGN_WITH!;

//   // 1. Initialize Turnkey EOA and Viem clients
//   const turnkeyEoa = await createAccount({
//     client: turnkeyClient.apiClient(),
//     organizationId: process.env.ORGANIZATION_ID!,
//     signWith: signWith,
//   });

//   const publicClient = createPublicClient({
//     chain: sepolia,
//     transport: http(process.env.RPC_URL),
//   });

//   // This wallet client is for our EOA. It will be used to sign the upgrade transaction.
//   const eoaWalletClient = createWalletClient({
//     account: turnkeyEoa,
//     chain: sepolia,
//     transport: http(process.env.RPC_URL),
//   });

//   debug(`Turnkey EOA address: ${turnkeyEoa.address}`);

//   // 2. Prepare and execute the account upgrade
//   debug("Preparing to upgrade EOA to a Porto wallet...");

//   // ASSUMPTION: The `porto/viem` SDK provides a way to represent an existing EOA
//   // as a `Key`. The snippet `Key.createSecp256k1` generates a *new* local key, which
//   // we cannot sign with via Turnkey. We need to authorize our Turnkey EOA as an admin
//   // on the new Porto account. I'm assuming an API like `Key.fromEoa` exists for this.
//   // If this is incorrect, we'll need to adjust it based on the actual API.
//   const turnkeyAsPortoKey = Key.fromSecp256k1({
//     address: turnkeyEoa.address,
//     role: "admin",
//   });

//   const {context, digests} = await RelayActions.prepareUpgradeAccount(publicClient, {
//     address: turnkeyEoa.address,
//     authorizeKeys: [],
//   });

//   debug("Upgrade prepared. Sending transaction...");

//   const signatures = {
//     auth: await turnkeyEoa.signMessage({message: digests.auth}),
//     exec: await turnkeyEoa.signMessage({message: digests.exec}),
//   }

//   eoaWalletClient.si

//   const upgradeTxHash = await RelayActions.upgradeAccount(
//     publicClient,
//     {
//       context,
//       digests,
//       signatures,
//     }
//   );

//   debug(`Upgrade transaction sent: ${upgradeTxHash}`);
//   const receipt = await publicClient.waitForTransactionReceipt({
//     hash: upgradeTxHash as `0x${string}`,
//   });

//   debug("Account successfully upgraded!");
//   debug(`https://sepolia.etherscan.io/tx/${receipt.transactionHash}`);

//   // 3. Interact with the upgraded Porto wallet
//   debug(
//     "Interacting with the new Porto wallet using wallet_sendCalls..."
//   );

//   const porto = Porto.create();
//   const portoWalletClient = createWalletClient({
//     chain: sepolia,
//     // Use Porto's custom transport to communicate with the smart account
//     transport: custom(porto.provider),
//   });

//   const userOpHash = await portoWalletClient.request({
//     method: "wallet_sendCalls",
//     params: [
//       {
//         // Per your request, `key: undefined` will default to using the EOA key
//         key: undefined,
//         calls: [
//           {
//             to: "0x0000000000000000000000000000000000000000",
//             value: 0n,
//             data: "0x",
//           },
//         ],
//       },
//     ],
//   });

//   debug(`User operation sent: ${userOpHash}`);
//   debug(
//     `See details at https://jiffyscan.xyz/userOpHash/${userOpHash}?network=sepolia`
//   );
// }

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
