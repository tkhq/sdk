import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ethers } from "ethers";
import prompts from "prompts";
import { findPrivateKeys, isKeyOfObject, fromReadableAmount } from "./utils";
import {
  createPrivateKey,
  createPrivateKeyTag,
  createUser,
  createUserTag,
  createPolicy,
  getOrganization,
} from "./requests";
import { getProvider, getTurnkeySigner } from "./provider";
import { sendEth, sendToken, wrapEth } from "./send";
import keys from "./keys";
import {
  ASSET_METADATA,
  WETH_TOKEN_GOERLI,
  USDC_TOKEN_GOERLI,
  APPROVE_SIGNATURE,
  DEPOSIT_SIGNATURE,
  GAS_MULTIPLIER,
  TRANSFER_SIGNATURE,
  NATIVE_TRANSFER_GAS_LIMIT,
  SWAP_ROUTER_ADDRESS,
  TRADE_SIGNATURE,
  DEFAULT_SLIPPAGE_TOLERANCE,
} from "./uniswap/constants";
import { prepareV3Trade, executeTrade } from "./uniswap/base";

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
    trade: trade,
    sweep: sweep,
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
  const adminTagId = await createUserTag("Admin", []);
  const traderTagId = await createUserTag("Trader", []);

  // setup users
  await createUser("Alice", [adminTagId], "Alice key", keys!.alice!.publicKey!);
  await createUser("Bob", [traderTagId], "Bob key", keys!.bob!.publicKey!);

  // setup private key tags
  const tradingTagId = await createPrivateKeyTag("trading", []);
  const personal = await createPrivateKeyTag("personal", []);
  const longTermStorageTagId = await createPrivateKeyTag(
    "long-term-storage",
    []
  );

  // setup private keys
  await createPrivateKey("Trading Wallet", [tradingTagId]);
  await createPrivateKey("Long Term Storage", [longTermStorageTagId]);
  await createPrivateKey("Personal", [personal]);

  // setup policies: grant specific users permissions to use specific private keys
  // ADMIN
  await createPolicy(
    "Admin users can do everything",
    "EFFECT_ALLOW",
    `approvers.any(user, user.tags.contains('${adminTagId}'))`,
    "true"
  );

  const paddedRouterAddress = SWAP_ROUTER_ADDRESS.toLowerCase()
    .substring(2)
    .padStart(64, "0");

  // TRADING
  await createPolicy(
    "Traders can use trading keys to deposit, aka wrap, ETH",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${traderTagId}')).count() >= 1`,
    `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${WETH_TOKEN_GOERLI.address}' && eth.tx.data[0..10] == '${DEPOSIT_SIGNATURE}'`
  );
  await createPolicy(
    "Traders can use trading keys to make ERC20 token approvals for WETH for usage with Uniswap",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${traderTagId}')).count() >= 1`,
    `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${WETH_TOKEN_GOERLI.address}' && eth.tx.data[0..10] == '${APPROVE_SIGNATURE}' && eth.tx.data[10..74] == '${paddedRouterAddress}'`
  );
  await createPolicy(
    "Traders can use trading keys to make ERC20 token approvals for USDC for usage with Uniswap",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${traderTagId}')).count() >= 1`,
    `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${USDC_TOKEN_GOERLI.address}' && eth.tx.data[0..10] == '${APPROVE_SIGNATURE}' && eth.tx.data[10..74] == '${paddedRouterAddress}'`
  );
  await createPolicy(
    "Traders can use trading keys to make trades using Uniswap",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${traderTagId}')).count() >= 1`,
    `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${SWAP_ROUTER_ADDRESS}' && eth.tx.data[0..10] == '${TRADE_SIGNATURE}'` // in theory, you can get more granular here with specific trade parameters
  );

  // SENDING
  // first, get long term storage address(es)
  const organization = await getOrganization();
  const longTermStoragePrivateKey = findPrivateKeys(
    organization,
    "long-term-storage"
  )[0];
  const longTermStorageAddress = longTermStoragePrivateKey?.addresses.find(
    (address: any) => {
      return address.format == "ADDRESS_FORMAT_ETHEREUM";
    }
  );
  if (!longTermStorageAddress || !longTermStorageAddress.address) {
    throw new Error(
      `couldn't lookup ETH address for private key: ${longTermStoragePrivateKey?.privateKeyId}`
    );
  }

  const paddedLongTermStorageAddress = longTermStorageAddress.address
    .toLowerCase()
    .substring(2)
    .padStart(64, "0");

  await createPolicy(
    "Traders can use trading keys to send ETH to long term storage addresses",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${traderTagId}')).count() >= 1`,
    `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${longTermStorageAddress.address!}' && eth.tx.data == '0x'` // empty data implies simple ETH send
  );
  await createPolicy(
    "Traders can use trading keys to send WETH to long term storage addresses",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${traderTagId}')).count() >= 1`,
    `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${WETH_TOKEN_GOERLI.address}' && eth.tx.data[0..10] == '${TRANSFER_SIGNATURE}' && eth.tx.data[10..74] == '${paddedLongTermStorageAddress}'`
  );
  await createPolicy(
    "Traders can use trading keys to send USDC to long term storage addresses",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${traderTagId}')).count() >= 1`,
    `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${USDC_TOKEN_GOERLI.address}' && eth.tx.data[0..10] == '${TRANSFER_SIGNATURE}' && eth.tx.data[10..74] == '${paddedLongTermStorageAddress}'`
  );
}

async function trade(options: { [key: string]: string }) {
  const baseAsset = options["baseAsset"]!.trim().toUpperCase(); // required
  const quoteAsset = options["quoteAsset"]!.trim().toUpperCase(); // required
  const baseAmount = options["baseAmount"]!.trim(); // whole amounts; optional

  const validAssets = ["ETH", "WETH", "USDC"];

  if (!validAssets.includes(baseAsset) || !validAssets.includes(quoteAsset)) {
    console.error(`
      Invalid base or quote asset.\n
      Base: ${baseAsset}\n
      Quote: ${quoteAsset}
    `);
  }

  await tradeImpl(baseAsset, quoteAsset, baseAmount);
}

async function tradeImpl(
  baseAsset: string,
  quoteAsset: string,
  baseAmount: string
) {
  const organization = await getOrganization();

  // find "trading" private key
  const tradingPrivateKey = findPrivateKeys(organization, "trading")[0];
  const provider = getProvider();
  const connectedSigner = getTurnkeySigner(
    provider,
    tradingPrivateKey!.privateKeyId
  );

  if (baseAsset === "ETH") {
    console.log(
      "For Uniswap trades, native ETH must first be converted to WETH.\n"
    );

    const feeData = await connectedSigner.getFeeData();
    const metadata = ASSET_METADATA["WETH"];
    const tokenContract = new ethers.Contract(
      metadata!.token.address,
      metadata!.abi,
      connectedSigner
    );
    const wrapAmount = fromReadableAmount(
      parseFloat(baseAmount),
      metadata!.token.decimals
    );

    const { confirmed } = await prompts([
      {
        type: "confirm",
        name: "confirmed",
        message: `Please confirm: wrap ${baseAmount} ETH?`,
      },
    ]);

    if (!confirmed) {
      console.log("Transaction unconfirmed. Skipping...\n");
      process.exit();
    }

    await wrapEth(connectedSigner, wrapAmount, tokenContract, feeData);

    baseAsset = "WETH"; // base asset is now considered WETH
    console.log(`Moving on to trading ${baseAsset} for ${quoteAsset}...\n`);
  }

  const metadata = ASSET_METADATA[baseAsset];
  const tokenContract = new ethers.Contract(
    metadata!.token.address,
    metadata!.abi,
    connectedSigner
  );

  const tokenBalance = await tokenContract.balanceOf(
    tradingPrivateKey?.addresses[0]?.address
  );

  const inputToken = ASSET_METADATA[baseAsset]!.token;
  const outputToken = ASSET_METADATA[quoteAsset]!.token;

  const inputAmount = fromReadableAmount(
    parseFloat(baseAmount),
    inputToken.decimals
  );

  // make balance check to confirm we can make the trade
  if (tokenBalance < inputAmount) {
    throw new Error(
      `Insufficient funds to perform this trade. Have: ${tokenBalance} ${inputToken.symbol}; Need: ${inputAmount} ${inputToken.symbol}.`
    );
  }

  // prepare trade
  const trade = await prepareV3Trade(
    connectedSigner,
    inputToken,
    outputToken,
    inputAmount
  );

  console.log("Trade parameters successfully prepared!\n");

  const { confirmed } = await prompts([
    {
      type: "confirm",
      name: "confirmed",
      message: `Please confirm: trade ${baseAmount} ${baseAsset} for ~${trade
        .minimumAmountOut(DEFAULT_SLIPPAGE_TOLERANCE)
        .toExact()} ${quoteAsset}?`,
    },
  ]);

  if (!confirmed) {
    console.log("Transaction unconfirmed. Skipping...\n");
    process.exit();
  }

  // execute trade
  await executeTrade(connectedSigner, trade, inputToken, inputAmount);
}

async function sweep(options: any) {
  // parse options
  const asset = options["asset"]!.trim().toUpperCase(); // required
  const destination = options["destination"] || "".trim(); // optional
  const amount = options["amount"]!.trim(); // whole amounts; optional. if not provided, will default to sending max amount

  const validAssets = ["ETH", "WETH", "USDC"];

  if (!validAssets.includes(asset)) {
    console.error(`
      Invalid asset: ${asset}\n
    `);
  }

  await sweepImpl(asset, destination, amount);
}

// sweep one asset at a time, and only to long term storage
async function sweepImpl(asset: string, destination: string, amount: string) {
  const organization = await getOrganization();

  // find trading private keys
  const tradingPrivateKey = findPrivateKeys(organization, "trading")[0]!;

  // find long term storage private key
  const longTermStoragePrivateKey = findPrivateKeys(
    organization,
    "long-term-storage"
  )[0];

  // send from trading address to long term storage
  const longTermStorageAddress = longTermStoragePrivateKey?.addresses.find(
    (address: any) => {
      return address.format == "ADDRESS_FORMAT_ETHEREUM";
    }
  );
  if (!longTermStorageAddress || !longTermStorageAddress.address) {
    throw new Error(
      `couldn't lookup ETH address for private key: ${longTermStoragePrivateKey?.privateKeyId}`
    );
  }
  if (destination.length === 0) {
    destination = longTermStorageAddress.address;
  }
  if (destination !== longTermStorageAddress.address) {
    console.error(
      "Destination is not authorized. Allowing script to continue as the policy engine will block the transaction...\n"
    );
  }

  const provider = getProvider();
  const connectedSigner = getTurnkeySigner(
    provider,
    tradingPrivateKey.privateKeyId
  );
  const feeData = await connectedSigner.getFeeData();

  feeData.maxFeePerGas = feeData.maxFeePerGas!.mul(GAS_MULTIPLIER);
  feeData.maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas!.mul(GAS_MULTIPLIER);

  if (asset === "ETH") {
    const balance = await connectedSigner.getBalance();
    const sweepAmount = fromReadableAmount(parseFloat(amount), 18) || balance;
    const gasRequired = feeData
      .maxFeePerGas!.add(feeData.maxPriorityFeePerGas!)
      .mul(NATIVE_TRANSFER_GAS_LIMIT);

    const finalAmount = sweepAmount.sub(gasRequired.mul(2)); // be relatively conservative with sweep amount to prevent overdraft

    // make balance check to confirm we can make the trade
    if (finalAmount.lte(0)) {
      throw new Error(`Insufficient funds to sweep ${sweepAmount} ETH.`);
    }

    console.log(`Sweeping ${finalAmount} ETH to ${destination}...\n`);

    const { confirmed } = await prompts([
      {
        type: "confirm",
        name: "confirmed",
        message: `Please confirm: sweep ${amount} ETH?`,
      },
    ]);

    if (!confirmed) {
      console.log("Transaction unconfirmed. Skipping...\n");
      process.exit();
    }

    await sendEth(provider, connectedSigner, destination, finalAmount, feeData);
  } else {
    const metadata = ASSET_METADATA[asset];
    const tokenContract = new ethers.Contract(
      metadata!.token.address,
      metadata!.abi,
      connectedSigner
    );
    const tokenBalance = await tokenContract.balanceOf(
      tradingPrivateKey?.addresses[0]?.address
    );
    const sweepAmount =
      fromReadableAmount(parseFloat(amount), metadata!.token.decimals) ||
      tokenBalance;

    // make balance check to confirm we can make the trade
    if (sweepAmount.gt(tokenBalance)) {
      throw new Error(
        `Insufficient funds to perform this sweep. Have: ${tokenBalance} ${
          metadata!.token.symbol
        }; Need: ${sweepAmount} ${metadata!.token.symbol}.`
      );
    }

    console.log(
      `Sweeping ${amount} ${metadata!.token.symbol} to ${destination}...\n`
    );

    const { confirmed } = await prompts([
      {
        type: "confirm",
        name: "confirmed",
        message: `Please confirm: sweep ${amount} ${metadata!.token.symbol}?`,
      },
    ]);

    if (!confirmed) {
      console.log("Transaction unconfirmed. Skipping...\n");
      process.exit();
    }

    await sendToken(
      provider,
      connectedSigner,
      destination,
      sweepAmount,
      metadata!.token,
      tokenContract,
      feeData
    );
  }
}
