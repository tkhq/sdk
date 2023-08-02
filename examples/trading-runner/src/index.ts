import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ethers } from "ethers";
import {
  findPrivateKeys,
  isKeyOfObject,
  print,
  fromReadableAmount,
} from "./utils";
import {
  createPrivateKey,
  createPrivateKeyTag,
  createUser,
  createUserTag,
  createPolicy,
  getOrganization,
} from "./requests";
import { getProvider, getTurnkeySigner } from "./provider";
import { sendEth } from "./send";
import keys from "./keys";
import {
  WETH_TOKEN_GOERLI,
  USDC_TOKEN_GOERLI,
  APPROVE_SIGNATURE,
  DEPOSIT_SIGNATURE,
  TRANSFER_SIGNATURE,
  SWAP_ROUTER_ADDRESS,
  TRADE_SIGNATURE,
  WETH_ABI,
  ERC20_ABI,
} from "./uniswap/constants";
import { prepareV3Trade, executeTrade } from "./uniswap/base";

const SWEEP_THRESHOLD = 100000000000000; // 0.0001 ETH
const TRANSFER_GAS_LIMIT = 21000;
const GAS_MULTIPLIER = 2;

const ASSET_METADATA: { [key: string]: { [key: string]: any } } = {
  WETH: {
    abi: WETH_ABI,
    token: WETH_TOKEN_GOERLI,
  },
  USDC: {
    abi: ERC20_ABI,
    token: USDC_TOKEN_GOERLI,
  },
};

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
    // add unauthorized send here
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

  const approveAddressParameter = SWAP_ROUTER_ADDRESS.substring(2).padStart(64, '0');

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
    `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${WETH_TOKEN_GOERLI.address}' && eth.tx.data[0..10] == '${APPROVE_SIGNATURE}' && eth.tx.data[10..74] == '${approveAddressParameter}'`
  );
  await createPolicy(
    "Traders can use trading keys to make ERC20 token approvals for USDC for usage with Uniswap",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${traderTagId}')).count() >= 1`,
    `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${USDC_TOKEN_GOERLI.address}' && eth.tx.data[0..10] == '${APPROVE_SIGNATURE}' && eth.tx.data[10..74] == '${approveAddressParameter}'`
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
  const longTermStoragePrivateKey = findPrivateKeys(organization, "long-term-storage")[0];
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
  await createPolicy(
    "Traders can use trading keys to send ETH to long term storage addresses",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${traderTagId}')).count() >= 1`,
    `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${longTermStorageAddress.address!}' && eth.tx.data == ''` // empty data implies simple ETH send
  );
  await createPolicy(
    "Traders can use trading keys to send WETH to long term storage addresses",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${traderTagId}')).count() >= 1`,
    `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${WETH_TOKEN_GOERLI.address}' && eth.tx.data[0..10] == '${TRANSFER_SIGNATURE}'`
  );
  await createPolicy(
    "Traders can use trading keys to send USDC to long term storage addresses",
    "EFFECT_ALLOW",
    `approvers.filter(user, user.tags.contains('${traderTagId}')).count() >= 1`,
    `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${USDC_TOKEN_GOERLI.address}' && eth.tx.data[0..10] == '${TRANSFER_SIGNATURE}'`
  );
}

// send funds from
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
  baseAmount: string,
) {
  const organization = await getOrganization();

  // find "trading" private key
  const tradingPrivateKey = findPrivateKeys(organization, "trading")[0];
  const provider = getProvider();
  const connectedSigner = getTurnkeySigner(
    provider,
    tradingPrivateKey!.privateKeyId
  );

  // Wrap if necessary. Should also account for gas
  if (baseAsset === "ETH") {
    console.log("For Uniswap trades, native ETH must first be converted to WETH.\n");

    const wethContract = new ethers.Contract(
      WETH_TOKEN_GOERLI.address,
      WETH_ABI,
      connectedSigner
    );

    if (!wethContract.populateTransaction.deposit) {
      console.error("Invalid contract call. Exiting...\n");
      return;
    }

    const populatedTx = await wethContract!.populateTransaction!.deposit({
      value: ethers.utils.parseEther(baseAmount),
    });

    console.log({
      tradingPrivateKey,
      populatedTx,
      // user: process.env.
    })

    const depositTx = await connectedSigner.sendTransaction({
      ...populatedTx,
      from: await connectedSigner.getAddress(),
    });

    console.log("Awaiting confirmation for wrap tx...\n");

    await provider.waitForTransaction(depositTx.hash, 1);

    print(
      `Wrapped ${ethers.utils.formatEther(depositTx.value)} ETH:`,
      `https://goerli.etherscan.io/tx/${depositTx.hash}` // hardcoded to goerli for now
    );

    baseAsset = "WETH"; // base asset is now considered WETH
  }

  const metadata = ASSET_METADATA[baseAsset];
  const tokenContract = new ethers.Contract(
    metadata!.token.address,
    metadata!.abi,
    connectedSigner
  );

  // make balance check to confirm we can make the trade
  const tokenBalance = await tokenContract.balanceOf(
    tradingPrivateKey?.addresses[0]?.address
  );

  const inputToken = ASSET_METADATA[baseAsset]!.token;
  const outputToken = ASSET_METADATA[quoteAsset]!.token;

  const inputAmount = fromReadableAmount(
    parseFloat(baseAmount),
    inputToken.decimals
  );

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

  console.log("Successfully prepared trade!\n");

  // execute trade
  let result = await executeTrade(
    connectedSigner,
    trade,
    inputToken,
    inputAmount
  );

  print(
    `Successfully executed trade via Uniswap v3:`,
    `https://goerli.etherscan.io/tx/${result.hash}`
  );
}

async function sweep(_options: any) {
  // parse options
  await sweepImpl();
}

// sweep one asset at a time, and only to long term storage
async function sweepImpl() {
  const organization = await getOrganization();

  // find long term storage private key
  const longTermStoragePrivateKey = findPrivateKeys(
    organization,
    "long-term-storage"
  )[0];

  // find trading private keys
  const tradingPrivateKeys = findPrivateKeys(organization, "trading");

  // send from short to long term storage
  const ethAddress = longTermStoragePrivateKey?.addresses.find(
    (address: any) => {
      return address.format == "ADDRESS_FORMAT_ETHEREUM";
    }
  );
  if (!ethAddress || !ethAddress.address) {
    throw new Error(
      `couldn't lookup ETH address for private key: ${longTermStoragePrivateKey?.privateKeyId}`
    );
  }

  for (const pk of tradingPrivateKeys!) {
    const provider = getProvider();
    const connectedSigner = getTurnkeySigner(provider, pk.privateKeyId);
    const balance = await connectedSigner.getBalance();
    const feeData = await connectedSigner.getFeeData();

    feeData.maxFeePerGas = feeData.maxFeePerGas!.mul(GAS_MULTIPLIER);
    feeData.maxPriorityFeePerGas =
      feeData.maxPriorityFeePerGas!.mul(GAS_MULTIPLIER);

    const gasRequired = feeData
      .maxFeePerGas!.add(feeData.maxPriorityFeePerGas!)
      .mul(TRANSFER_GAS_LIMIT); // 21000 is the gas limit for a simple transfer

    if (balance.lt(SWEEP_THRESHOLD)) {
      console.log("Insufficient balance for sweep. Moving on...");
      continue;
    }

    const sweepAmount = balance.sub(gasRequired.mul(2)); // be relatively conservative with sweep amount to prevent overdraft

    if (sweepAmount.lt(0)) {
      console.log("Insufficient balance for sweep. Moving on...");
      continue;
    }

    await sendEth(
      provider,
      connectedSigner,
      ethAddress.address,
      sweepAmount,
      feeData
    );
  }
}
