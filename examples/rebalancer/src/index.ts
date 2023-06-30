import * as path from "path";
import * as dotenv from "dotenv";
import { isKeyOfObject } from "./utils";
import {
  getOrganization,
  createPrivateKey,
  createPrivateKeyTag,
  createUser,
  createUserTag,
  createPolicy,
} from "./requests";
import { getProvider, getTurnkeySigner } from "./provider";
import { sendEth } from "./send";
import keys from "./keys";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SWEEP_THRESHOLD = 100000000000000; // 0.0001 ETH

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
async function fund(_options: any) {
  const organization = await getOrganization();

  // find "Bank" private key
  const bankTag = organization.tags?.find((tag: any) => {
    const isPrivateKeyTag = tag.tagType == "TAG_TYPE_PRIVATE_KEY";
    const isBankTag = tag.tagName == "Bank";
    return isPrivateKeyTag && isBankTag;
  });

  const bankPrivateKey = organization.privateKeys?.find((privateKey: any) => {
    return privateKey.privateKeyTags.includes(bankTag!.tagId);
  });

  // find "Source" private keys
  const sourceTag = organization.tags?.find((tag: any) => {
    const isPrivateKeyTag = tag.tagType == "TAG_TYPE_PRIVATE_KEY";
    const isSourceTag = tag.tagName == "Source";
    return isPrivateKeyTag && isSourceTag;
  });

  const sourcePrivateKeys = organization.privateKeys?.filter(
    (privateKey: any) => {
      return privateKey.privateKeyTags.includes(sourceTag!.tagId);
    }
  );

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
      120000000000000 // 0.00012 ETH
    );
  }
}

// TODO(tim): pass options (e.g. source private keys, amount, etc)
async function sweep(_options: any) {
  const organization = await getOrganization();

  // find "Sink" private key
  const sinkTag = organization.tags?.find((tag) => {
    const isPrivateKeyTag = tag.tagType == "TAG_TYPE_PRIVATE_KEY";
    const isSinkTag = tag.tagName == "Sink";
    return isPrivateKeyTag && isSinkTag;
  });

  const sinkPrivateKey = organization.privateKeys?.find((privateKey) => {
    return privateKey.privateKeyTags.includes(sinkTag!.tagId);
  });

  // find "Source" private keys
  const sourceTag = organization.tags?.find((tag) => {
    const isPrivateKeyTag = tag.tagType == "TAG_TYPE_PRIVATE_KEY";
    const isSourceTag = tag.tagName == "Source";
    return isPrivateKeyTag && isSourceTag;
  });

  const sourcePrivateKeys = organization.privateKeys?.filter((privateKey) => {
    return privateKey.privateKeyTags.includes(sourceTag!.tagId);
  });

  // send from "Source"s to "Sink"
  const ethAddress = sinkPrivateKey?.addresses.find((address) => {
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
    const gasRequired = feeData.maxFeePerGas!.mul(21000); // 21000 is the gas limit for a simple transfer

    if (balance.lt(SWEEP_THRESHOLD)) {
      console.log("Insufficient balance for sweep. Moving on...");
      continue;
    }

    const sweepAmount = balance.sub(gasRequired);

    // TODO(tim): check balance and only sweep excess funds based on passed in amount
    await sendEth(
      provider,
      connectedSigner,
      ethAddress.address,
      sweepAmount.toNumber()
    );
  }
}

// TODO(tim): pass options (e.g. amount, etc)
async function recycle(_options: any) {
  const organization = await getOrganization();

  // find "Sink" private key
  const sinkTag = organization.tags?.find((tag) => {
    const isPrivateKeyTag = tag.tagType == "TAG_TYPE_PRIVATE_KEY";
    const isSinkTag = tag.tagName == "Sink";
    return isPrivateKeyTag && isSinkTag;
  });

  const sinkPrivateKey = organization.privateKeys?.find((privateKey) => {
    return privateKey.privateKeyTags.includes(sinkTag!.tagId);
  });

  // find "Bank" private key
  const bankTag = organization.tags?.find((tag) => {
    const isPrivateKeyTag = tag.tagType == "TAG_TYPE_PRIVATE_KEY";
    const isBankTag = tag.tagName == "Bank";
    return isPrivateKeyTag && isBankTag;
  });

  const bankPrivateKey = organization.privateKeys?.find((privateKey) => {
    return privateKey.privateKeyTags.includes(bankTag!.tagId);
  });

  // send from "Sink" to "Bank"
  const provider = getProvider();
  const connectedSigner = getTurnkeySigner(
    provider,
    sinkPrivateKey!.privateKeyId
  );

  const ethAddress = bankPrivateKey?.addresses.find((address) => {
    return address.format == "ADDRESS_FORMAT_ETHEREUM";
  });
  if (!ethAddress || !ethAddress.address) {
    throw new Error(
      `couldn't lookup ETH address for private key: ${bankPrivateKey?.privateKeyId}`
    );
  }

  const balance = await connectedSigner.getBalance();
  const feeData = await connectedSigner.getFeeData();
  const gasRequired = feeData.maxFeePerGas!.mul(21000); // 21000 is the gas limit for a simple transfer
  const recycleAmount = balance.sub(gasRequired);

  // TODO(tim): pass this amount in
  await sendEth(
    provider,
    connectedSigner,
    ethAddress.address,
    recycleAmount.toNumber()
  );
}
