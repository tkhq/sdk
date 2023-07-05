import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ethers } from "ethers";
import { findPrivateKeys, isKeyOfObject } from "./utils";
import {
  createPrivateKey,
  createPrivateKeyTag,
  createUser,
  createUserTag,
  createPolicy,
  getActivities,
  getOrganization,
} from "./requests";
import { getProvider, getTurnkeySigner } from "./provider";
import { sendEth, broadcastTx } from "./send";
import keys from "./keys";

const SWEEP_THRESHOLD = 100000000000000; // 0.0001 ETH
const MIN_INTERVAL_MS = 10000; // 10 seconds
const MAX_INTERVAL_MS = 60000; // 60 seconds
const TRANSFER_GAS_LIMIT = 21000;

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    throw new Error("Command is required");
  }

  const command = args[0];
  const options: { [key: string]: any } = {};

  for (const arg of args.slice(1)) {
    if (!arg.startsWith("--")) {
      throw new Error(`flags must begin with '--': ${arg}`);
    }

    const parts = arg.slice(2).split("=");
    if (parts.length != 2) {
      throw new Error(`flags must have syntax '--key=value': ${arg}`);
    }

    const key = parts[0];
    const value = parts[1];

    if (!key) {
      throw new Error(`invalid flags provided`);
    }
    options[key] = value;
  }

  // overwrite key env vars
  if (isKeyOfObject("key", options)) {
    let keyName = options["key"];

    if (!isKeyOfObject(keyName, keys)) {
      throw new Error(`no key defined with name: ${keyName}`);
    }

    process.env.API_PUBLIC_KEY = keys[keyName].publicKey;
    process.env.API_PRIVATE_KEY = keys[keyName].privateKey;
  }

  const commands = {
    setup: setup,
    fund: fund,
    sweep: sweep,
    recycle: recycle,
    pollAndBroadcast: pollAndBroadcast,
  };

  if (!isKeyOfObject(command!, commands)) {
    throw new Error(`Unknown command: ${command}`);
  }

  commands[command](options);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// TODO(tim): pass options (e.g. "X" source private keys)
async function setup(_options: any) {
  // setup user tags
  const adminTagId = await createUserTag("Admin", []);
  const managerTagId = await createUserTag("Manager", []);
  const executorTagId = await createUserTag("Executor", []);

  // setup users
  await createUser("Alice", [adminTagId], "Alice key", keys.alice.publicKey);
  await createUser("Bob", [managerTagId], "Bob key", keys.bob.publicKey);
  await createUser("Phil", [executorTagId], "Phil key", keys.phil.publicKey);

  // setup private key tags
  const bankTagId = await createPrivateKeyTag("Bank", []);
  const sinkTagId = await createPrivateKeyTag("Sink", []);
  const sourceTagId = await createPrivateKeyTag("Source", []);

  // setup private keys
  await createPrivateKey("Bank key", [bankTagId]);
  await createPrivateKey("Sink key", [sinkTagId]);
  await createPrivateKey("Source key 1", [sourceTagId]);
  await createPrivateKey("Source key 2", [sourceTagId]);
  await createPrivateKey("Source key 3", [sourceTagId]);

  // setup policies
  // grant specific users permissions to use specific private keys
  await createPolicy(
    "Admin users can do everything",
    "EFFECT_ALLOW",
    `approvers.any(user, user.tags.contains('${adminTagId}'))`,
    "true"
  );
  await createPolicy(
    "Two Manager or Admin users can use Sink keys",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${managerTagId}') || user.tags.contains('${adminTagId}')).count() >= 2`,
    `private_key.tags.contains('${sinkTagId}')`
  );
  await createPolicy(
    "Executor users can use Source keys",
    "EFFECT_ALLOW",
    `approvers.any(user, user.tags.contains('${executorTagId}'))`,
    `private_key.tags.contains('${sourceTagId}')`
  );

  // TODO(tim): tighten policies to enforce keys can only send to specific addresses
}

// TODO(tim): pass options (e.g. source private keys, amount, etc)
async function fund(options: any) {
  const interval = parseInt(options["interval"]);

  if (interval < MIN_INTERVAL_MS || interval > MAX_INTERVAL_MS) {
    console.log(
      `Invalid interval: ${interval}. Please specify a value between 10000 and 60000 milliseconds`
    );
  }

  await fundImpl();
  interval && setInterval(async () => await fundImpl(), interval);
}

async function fundImpl() {
  const organization = await getOrganization();

  // find "Bank" private key
  const bankPrivateKey = findPrivateKeys(organization, "Bank")[0];

  // find "Source" private keys
  const sourcePrivateKeys = findPrivateKeys(organization, "Source");

  // send from "Bank" to "Source"
  const provider = getProvider();
  const connectedSigner = getTurnkeySigner(
    provider,
    bankPrivateKey!.privateKeyId
  );

  for (const sourcePrivateKey of sourcePrivateKeys!) {
    const ethAddress = sourcePrivateKey.addresses.find((address: any) => {
      return address.format == "ADDRESS_FORMAT_ETHEREUM";
    });
    if (!ethAddress || !ethAddress.address) {
      throw new Error(
        `couldn't lookup ETH address for private key: ${sourcePrivateKey.privateKeyId}`
      );
    }

    // TODO(tim): pass this amount in
    await sendEth(
      provider,
      connectedSigner,
      ethAddress.address,
      ethers.BigNumber.from(120000000000000) // 0.00012 ETH
    );
  }
}

// TODO(tim): pass options (e.g. source private keys, amount, etc)
async function sweep(options: any) {
  const interval = parseInt(options["interval"]);

  if (interval < MIN_INTERVAL_MS || interval > MAX_INTERVAL_MS) {
    console.log(
      `Invalid interval: ${interval}. Please specify a value between 10000 and 60000 milliseconds`
    );
  }

  await sweepImpl();
  interval && setInterval(async () => await sweepImpl(), interval);
}

async function sweepImpl() {
  const organization = await getOrganization();

  // find "Sink" private key
  const sinkPrivateKey = findPrivateKeys(organization, "Sink")[0];

  // find "Source" private keys
  const sourcePrivateKeys = findPrivateKeys(organization, "Source");

  // send from "Source"s to "Sink"
  const ethAddress = sinkPrivateKey?.addresses.find((address: any) => {
    return address.format == "ADDRESS_FORMAT_ETHEREUM";
  });
  if (!ethAddress || !ethAddress.address) {
    throw new Error(
      `couldn't lookup ETH address for private key: ${sinkPrivateKey?.privateKeyId}`
    );
  }

  for (const sourcePrivateKey of sourcePrivateKeys!) {
    const provider = getProvider();
    const connectedSigner = getTurnkeySigner(
      provider,
      sourcePrivateKey.privateKeyId
    );
    const balance = await connectedSigner.getBalance();
    const feeData = await connectedSigner.getFeeData();
    const gasRequired = feeData
      .maxFeePerGas!.add(feeData.maxPriorityFeePerGas!)
      .mul(TRANSFER_GAS_LIMIT); // 21000 is the gas limit for a simple transfer

    if (balance.lt(SWEEP_THRESHOLD)) {
      console.log("Insufficient balance for sweep. Moving on...");
      continue;
    }

    const sweepAmount = balance.sub(gasRequired.mul(2)); // be relatively conservative with sweep amount to prevent overdraft

    // TODO(tim): check balance and only sweep excess funds based on passed in amount
    await sendEth(
      provider,
      connectedSigner,
      ethAddress.address,
      sweepAmount,
      feeData
    );
  }
}

// TODO(tim): pass options (e.g. amount, etc)
async function recycle(options: any) {
  const interval = parseInt(options["interval"]);

  if (interval < MIN_INTERVAL_MS || interval > MAX_INTERVAL_MS) {
    console.log(
      `Invalid interval: ${interval}. Please specify a value between 10000 and 60000 milliseconds`
    );
  }

  await recycleImpl();
  interval && setInterval(async () => await recycleImpl, interval);
}

async function recycleImpl() {
  const organization = await getOrganization();

  // find "Sink" private key
  const sinkPrivateKey = findPrivateKeys(organization, "Sink")[0];

  // find "Bank" private key
  const bankPrivateKey = findPrivateKeys(organization, "Bank")[0];

  // send from "Sink" to "Bank"
  const provider = getProvider();
  const connectedSigner = getTurnkeySigner(
    provider,
    sinkPrivateKey!.privateKeyId
  );

  const ethAddress = bankPrivateKey?.addresses.find((address: any) => {
    return address.format == "ADDRESS_FORMAT_ETHEREUM";
  });
  if (!ethAddress || !ethAddress.address) {
    throw new Error(
      `couldn't lookup ETH address for private key: ${bankPrivateKey?.privateKeyId}`
    );
  }

  const balance = await connectedSigner.getBalance();
  const feeData = await connectedSigner.getFeeData();
  const gasRequired = feeData
    .maxFeePerGas!.add(feeData.maxPriorityFeePerGas!)
    .mul(TRANSFER_GAS_LIMIT); // 21000 is the gas limit for a simple transfer
  const recycleAmount = balance.sub(gasRequired.mul(2)); // be relatively conservative with sweep amount to prevent overdraft

  // TODO(tim): pass this amount in
  await sendEth(
    provider,
    connectedSigner,
    ethAddress.address,
    recycleAmount,
    feeData
  );
}

// two approaches:
// (1) if there's a pending/consensus needed activity, save its ID and check on it later (stateful)
// (2) simply attempt to broadcast all signed transactions, based on when the activity was approved/completed
// Poll for pending recycle transactions (which originate from the `sink` address)
function pollAndBroadcast(options: any) {
  const interval = parseInt(options["interval"]);

  if (interval < MIN_INTERVAL_MS || interval > MAX_INTERVAL_MS) {
    console.log(
      `Invalid interval: ${interval}. Please specify a value between 10000 and 60000 milliseconds`
    );
  }

  pollAndBroadcastImpl();
  interval && setInterval(pollAndBroadcastImpl, interval);
}

async function pollAndBroadcastImpl() {
  const organization = await getOrganization();

  // find "Sink" private key
  const sinkPrivateKey = findPrivateKeys(organization, "Sink")[0];
  const activities = await getActivities();
  const relevantActivities = activities.filter((activity) => {
    return (
      activity.type === "ACTIVITY_TYPE_SIGN_TRANSACTION" &&
      activity.status === "ACTIVITY_STATUS_COMPLETED" &&
      activity.intent.signTransactionIntent?.privateKeyId ===
        sinkPrivateKey.privateKeyId
    );
  });

  if (relevantActivities.length === 0) {
    console.log(
      "No transactions are ready for broadcasting. Double check activities that need consensus.\n"
    );
  }

  for (let activity of relevantActivities) {
    try {
      const provider = getProvider();
      const signedTx = `0x${activity.result.signTransactionResult
        ?.signedTransaction!}`;

      await broadcastTx(provider, signedTx, activity.id);
    } catch (error: any) {
      console.error("Encountered error:", error.toString());
    }
  }
}
