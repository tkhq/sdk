import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey } from "@turnkey/sdk-server";
import { FeeData } from "ethers";
import { isKeyOfObject } from "./utils";
import {
  createPrivateKey,
  createPrivateKeyTag,
  createUser,
  createUserTag,
  createPolicy,
  getActivities,
  getActivity,
  getPrivateKeysForTag,
  createActivityApproval,
  createActivityRejection,
} from "./requests";
import { getProvider, getTurnkeySigner } from "./provider";
import { sendEth, broadcastTx } from "./send";
import keys from "./keys";

const SWEEP_THRESHOLD = 100000000000000; // 0.0001 ETH
const MIN_INTERVAL_MS = 10000; // 10 seconds
const MAX_INTERVAL_MS = 60000; // 60 seconds
const TRANSFER_GAS_LIMIT = 21000n;
const GAS_MULTIPLIER = 2n;
const ACTIVITIES_LIMIT = "100";

// For demonstration purposes, create a globally accessible TurnkeyClient
const turnkeyClient = new Turnkey({
  apiBaseUrl: process.env.BASE_URL!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.ORGANIZATION_ID!,
});

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    throw new Error("Command is required");
  }

  const command = args[0];
  const options: { [key: string]: string | undefined } = {};

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

    process.env.API_PUBLIC_KEY = keys[keyName]!.publicKey;
    process.env.API_PRIVATE_KEY = keys[keyName]!.privateKey;
  }

  const commands: { [key: string]: Function } = {
    setup: setup,
    fund: fund,
    sweep: sweep,
    recycle: recycle,
    pollAndBroadcast: pollAndBroadcast,
    approveActivity: approveActivity,
    rejectActivity: rejectActivity,
  };

  if (!isKeyOfObject(command!, commands)) {
    throw new Error(`Unknown command: ${command}`);
  }

  commands[command]!(options);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function setup(_options: any) {
  // setup user tags
  const adminTagId = await createUserTag(turnkeyClient, "Admin", []);
  const managerTagId = await createUserTag(turnkeyClient, "Manager", []);
  const executorTagId = await createUserTag(turnkeyClient, "Executor", []);

  // setup users
  await createUser(
    turnkeyClient,
    "Alice",
    [adminTagId],
    "Alice key",
    keys!.alice!.publicKey!
  );
  await createUser(
    turnkeyClient,
    "Bob",
    [managerTagId],
    "Bob key",
    keys!.bob!.publicKey!
  );
  await createUser(
    turnkeyClient,
    "Phil",
    [executorTagId],
    "Phil key",
    keys!.phil!.publicKey!
  );

  // setup private key tags
  const distributionTagId = await createPrivateKeyTag(
    turnkeyClient,
    "distribution",
    []
  );
  const shortTermStorageTagId = await createPrivateKeyTag(
    turnkeyClient,
    "short-term-storage",
    []
  );
  const longTermStorageTagId = await createPrivateKeyTag(
    turnkeyClient,
    "long-term-storage",
    []
  );

  // setup private keys
  await createPrivateKey(turnkeyClient, "Distribution", [distributionTagId]);
  await createPrivateKey(turnkeyClient, "Long Term Storage", [
    longTermStorageTagId,
  ]);
  await createPrivateKey(turnkeyClient, "Short Term Storage 1", [
    shortTermStorageTagId,
  ]);
  await createPrivateKey(turnkeyClient, "Short Term Storage 2", [
    shortTermStorageTagId,
  ]);
  await createPrivateKey(turnkeyClient, "Short Term Storage 3", [
    shortTermStorageTagId,
  ]);

  // setup policies
  // grant specific users permissions to use specific private keys
  await createPolicy(
    turnkeyClient,
    "Admin users can do everything",
    "EFFECT_ALLOW",
    `approvers.any(user, user.tags.contains('${adminTagId}'))`,
    "true"
  );
  await createPolicy(
    turnkeyClient,
    "Two Manager or Admin users can use long term storage keys",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${managerTagId}') || user.tags.contains('${adminTagId}')).count() >= 2`,
    `private_key.tags.contains('${longTermStorageTagId}')`
  );
  await createPolicy(
    turnkeyClient,
    "Executor users can use short term storage keys",
    "EFFECT_ALLOW",
    `approvers.any(user, user.tags.contains('${executorTagId}'))`,
    `private_key.tags.contains('${shortTermStorageTagId}')`
  );
}

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
  // find "Distribution" private key
  const distributionPrivateKeys = await getPrivateKeysForTag(
    turnkeyClient,
    "distribution"
  );

  // find "Short Term Storage" private keys
  const shortTermStoragePrivateKeys = await getPrivateKeysForTag(
    turnkeyClient,
    "short-term-storage"
  );

  // send from "Distribution" to "Short Term Storage"
  const provider = getProvider();
  const connectedSigner = getTurnkeySigner(
    provider,
    distributionPrivateKeys[0]!.privateKeyId
  );

  for (const pk of shortTermStoragePrivateKeys) {
    const ethAddress = pk.addresses.find((address: any) => {
      return address.format == "ADDRESS_FORMAT_ETHEREUM";
    });
    if (!ethAddress || !ethAddress.address) {
      throw new Error(
        `couldn't lookup ETH address for private key: ${pk.privateKeyId}`
      );
    }

    await sendEth(
      connectedSigner,
      ethAddress.address,
      120000000000000n // 0.00012 ETH
    );
  }
}

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
  // find long term storage private key
  const longTermStoragePrivateKeys = await getPrivateKeysForTag(
    turnkeyClient,
    "long-term-storage"
  );

  // find short term storage private keys
  const shortTermStoragePrivateKeys = await getPrivateKeysForTag(
    turnkeyClient,
    "short-term-storage"
  );

  // send from short to long term storage
  const longTermStorageAddress = longTermStoragePrivateKeys[0]!.addresses.find(
    (address: any) => {
      return address.format == "ADDRESS_FORMAT_ETHEREUM";
    }
  );
  if (!longTermStorageAddress || !longTermStorageAddress.address) {
    throw new Error(
      `couldn't lookup ETH address for private key: ${
        longTermStoragePrivateKeys[0]!.privateKeyId
      }`
    );
  }

  for (const pk of shortTermStoragePrivateKeys!) {
    const provider = getProvider();
    const connectedSigner = getTurnkeySigner(provider, pk.privateKeyId);
    const address = await connectedSigner.getAddress();
    const balance = (await connectedSigner.provider?.getBalance(address)) ?? 0n;
    const originalFeeData = await connectedSigner.provider?.getFeeData();

    const updatedMaxFeePerGas = originalFeeData?.maxFeePerGas
      ? originalFeeData.maxFeePerGas * GAS_MULTIPLIER
      : 0n;
    const updatedMaxPriorityFeePerGas = originalFeeData?.maxPriorityFeePerGas
      ? originalFeeData.maxPriorityFeePerGas * GAS_MULTIPLIER
      : 0n;
    const feeData = new FeeData(
      originalFeeData?.gasPrice,
      updatedMaxFeePerGas,
      updatedMaxPriorityFeePerGas
    );
    const gasRequired =
      feeData?.maxFeePerGas && feeData?.maxPriorityFeePerGas
        ? (feeData?.maxFeePerGas + feeData?.maxPriorityFeePerGas) *
          TRANSFER_GAS_LIMIT
        : 0n;

    if (balance < SWEEP_THRESHOLD) {
      console.log(
        `Address ${address} has an insufficient balance for sweep. Moving on...`
      );
      continue;
    }

    const sweepAmount = balance - gasRequired * 2n; // be relatively conservative with sweep amount to prevent overdraft

    if (sweepAmount === 0n) {
      console.log(
        `Address ${address} has an insufficient balance for sweep. Moving on...`
      );
      continue;
    }

    await sendEth(
      connectedSigner,
      longTermStorageAddress.address,
      sweepAmount,
      feeData
    );
  }
}

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
  // find "Long Term Storage" private key
  const longTermStoragePrivateKeys = await getPrivateKeysForTag(
    turnkeyClient,
    "long-term-storage"
  );

  // find "Distribution" private key
  const distributionPrivateKeys = await getPrivateKeysForTag(
    turnkeyClient,
    "distribution"
  );

  // send from "Long Term Storage" to "Distribution"
  const provider = getProvider();
  const connectedSigner = getTurnkeySigner(
    provider,
    longTermStoragePrivateKeys[0]!.privateKeyId
  );

  const longTermStorageAddress = await connectedSigner.getAddress();

  const distributionAddress = distributionPrivateKeys[0]!.addresses.find(
    (address: any) => {
      return address.format == "ADDRESS_FORMAT_ETHEREUM";
    }
  );
  if (!distributionAddress || !distributionAddress.address) {
    throw new Error(
      `couldn't lookup ETH address for private key: ${
        distributionPrivateKeys[0]!.privateKeyId
      }`
    );
  }

  const balance =
    (await connectedSigner.provider?.getBalance(longTermStorageAddress)) ?? 0n;

  const originalFeeData = await connectedSigner.provider?.getFeeData();

  const updatedMaxFeePerGas = originalFeeData?.maxFeePerGas
    ? originalFeeData.maxFeePerGas * GAS_MULTIPLIER
    : null;
  const updatedMaxPriorityFeePerGas = originalFeeData?.maxPriorityFeePerGas
    ? originalFeeData.maxPriorityFeePerGas * GAS_MULTIPLIER
    : null;
  const feeData = new FeeData(
    originalFeeData?.gasPrice,
    updatedMaxFeePerGas,
    updatedMaxPriorityFeePerGas
  );
  const gasRequired =
    feeData?.maxFeePerGas && feeData?.maxPriorityFeePerGas
      ? (feeData?.maxFeePerGas + feeData?.maxPriorityFeePerGas) *
        TRANSFER_GAS_LIMIT
      : 0n;

  const recycleAmount = balance - gasRequired * 2n; // be relatively conservative with sweep amount to prevent overdraft

  if (recycleAmount <= 0n) {
    console.log("Insufficient balance for recycle...");
    return;
  }

  await sendEth(
    connectedSigner,
    distributionAddress.address,
    recycleAmount,
    feeData
  );
}

// two approaches:
// (1) if there's a pending/consensus needed activity, save its ID and check on it later (stateful)
// (2) simply attempt to broadcast all signed transactions, based on when the activity was approved/completed
// Poll for pending recycle transactions (which originate from the `Long Term Storage` address)
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
  // find "Long Term Storage" private key
  const longTermStoragePrivateKeys = await getPrivateKeysForTag(
    turnkeyClient,
    "long-term-storage"
  );
  const activities = await getActivities(turnkeyClient, ACTIVITIES_LIMIT);

  const relevantActivities = activities.filter((activity) => {
    return (
      activity.type === "ACTIVITY_TYPE_SIGN_TRANSACTION" &&
      activity.status === "ACTIVITY_STATUS_COMPLETED" &&
      activity.intent.signTransactionIntent?.privateKeyId ===
        longTermStoragePrivateKeys[0]!.privateKeyId
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
      console.error("Encountered error:", error.toString(), "\n");
    }
  }
}

async function approveActivity(options: any) {
  const activityId = options["id"];

  if (!activityId) {
    console.error("Must provide valid activity ID.\n");
  }
  const activity = await getActivity(turnkeyClient, activityId);
  await createActivityApproval(turnkeyClient, activityId, activity.fingerprint);
}

async function rejectActivity(options: any) {
  const activityId = options["id"];

  if (!activityId) {
    console.error("Must provide valid activity ID.\n");
  }
  const activity = await getActivity(turnkeyClient, activityId);
  await createActivityRejection(
    turnkeyClient,
    activityId,
    activity.fingerprint
  );
}
