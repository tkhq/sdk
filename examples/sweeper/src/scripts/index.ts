import * as path from "path";
import * as dotenv from "dotenv";
// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ethers } from "ethers";
import prompts from "prompts";
import { getTurnkeyClient, pollTransactionStatus } from "../turnkey";
import { toReadableAmount } from "../utils";
import {
  ERC20_ABI,
  NETWORKS,
  type NetworkConfig,
  type SupportedNetwork,
} from "../tokens";

const SUPPORTED_NETWORKS = Object.keys(NETWORKS) as SupportedNetwork[];

// resolveDefaultNetwork validates the env-backed selection so every downstream
// call can rely on a single network config object.
function resolveDefaultNetwork(): SupportedNetwork {
  const configuredNetwork = (process.env.SWEEPER_NETWORK ?? "sepolia").toLowerCase();

  if (SUPPORTED_NETWORKS.includes(configuredNetwork as SupportedNetwork)) {
    return configuredNetwork as SupportedNetwork;
  }

  throw new Error(
    `Invalid SWEEPER_NETWORK "${configuredNetwork}". Valid options: ${SUPPORTED_NETWORKS.join(", ")}`,
  );
}

export async function main() {
  const orgId = process.env.ORGANIZATION_ID!;
  const signWith = process.env.SIGN_WITH!;
  const turnkey = getTurnkeyClient();
  const address = signWith;
  const destination = process.env.DESTINATION_ADDRESS!;
  const defaultNetwork = resolveDefaultNetwork();
  const { networkName } = await prompts({
    type: "select",
    name: "networkName",
    message: "Select network:",
    initial: SUPPORTED_NETWORKS.indexOf(defaultNetwork),
    choices: [
      {
        title: "Ethereum Sepolia",
        description: "Testnet",
        value: "sepolia",
      },
      {
        title: "Base Mainnet",
        description: "Production",
        value: "base",
      },
    ],
  });

  if (!networkName) {
    console.log("Operation cancelled.");
    return;
  }

  const network = NETWORKS[networkName as SupportedNetwork];
  const provider = new ethers.JsonRpcProvider(network.rpcUrl);

  // Fetch ETH balance
  const balance = await provider.getBalance(address);

  console.log("Network:", network.label);
  console.log("Address:", address);
  console.log("Eth Balance:", ethers.formatEther(balance));

  let sponsor = false;
  const { useSponsor } = await prompts({
    type: "confirm",
    name: "useSponsor",
    message: "Use Turnkey gas sponsorship for sweep transactions?",
    initial: false,
  });
  sponsor = !!useSponsor;

  if (!sponsor) {
    if (balance === 0n) {
      console.warn("Not enough ETH.");
      return;
    }
  }

  await sweepTokens(
    turnkey,
    orgId,
    address,
    destination,
    network,
    provider,
    sponsor,
  );
  await sweepEth(turnkey, orgId, address, destination, network, provider, sponsor);
}

async function sweepTokens(
  turnkey: any,
  organizationId: string,
  ownerAddress: string,
  destination: string,
  network: NetworkConfig,
  provider: ethers.JsonRpcProvider,
  sponsor: boolean,
) {
  for (const token of network.tokens) {
    const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
    const balance: bigint = await (contract as any).balanceOf(ownerAddress);

    if (balance === 0n) {
      console.log(`No ${token.symbol}. Skipping...`);
      continue;
    }

    const { confirmed } = await prompts({
      type: "confirm",
      name: "confirmed",
      message: `Transfer ${toReadableAmount(
        balance,
        token.decimals,
      )} ${token.symbol} to ${destination}?`,
    });

    if (!confirmed) continue;

    // Build calldata manually for ERC-20 transfer
    const iface = new ethers.Interface(ERC20_ABI);
    const calldata = iface.encodeFunctionData("transfer", [
      destination,
      balance,
    ]);

    // Fetch nonce (same pattern as sweepEth)
    const resp = await turnkey.apiClient().getNonces({
      organizationId,
      address: ownerAddress,
      caip2: network.caip2,
      nonce: sponsor ? false : true,
      gasStationNonce: sponsor ? true : false,
    });

    const { nonce } = resp;
    const { gasStationNonce } = resp;
    // Submit transaction via Turnkey
    const { sendTransactionStatusId } = await turnkey
      .apiClient()
      .ethSendTransaction({
        organizationId,
        from: ownerAddress,
        to: token.address,
        caip2: network.caip2,
        gasStationNonce: sponsor ? gasStationNonce : undefined,
        nonce: sponsor ? undefined : nonce,
        sponsor,
        data: calldata,
        gasLimit: sponsor ? undefined : "200000",
      });

    // Poll for final inclusion
    const status = await pollTransactionStatus({
      apiClient: turnkey.apiClient(),
      organizationId,
      sendTransactionStatusId,
    });

    if (status.txStatus !== "INCLUDED") {
      throw new Error(
        `${token.symbol} sweep failed with status: ${status.txStatus}`,
      );
    }

    console.log(
      `Sent ${token.symbol}: ${network.explorerBaseUrl}/tx/${status.eth?.txHash}`,
    );
  }
}

async function sweepEth(
  turnkey: any,
  organizationId: string,
  ownerAddress: string,
  destination: string,
  network: NetworkConfig,
  provider: ethers.JsonRpcProvider,
  sponsor: boolean,
) {
  const balance = await provider.getBalance(ownerAddress);
  const feeData = await provider.getFeeData();

  const gas = 93000n;

  const maxPriorityFee = feeData.maxPriorityFeePerGas;

  const maxFee = feeData.maxFeePerGas;

  const gasCost = gas * maxFee!;
  const value = balance - gasCost;

  if (value <= 0n) {
    console.warn("Not enough ETH to sweep.");
    return;
  }

  const { confirmed } = await prompts({
    type: "confirm",
    name: "confirmed",
    message: `Sweep ${ethers.formatEther(value)} ETH to ${destination}?`,
  });

  if (!confirmed) return;
  const resp = await turnkey.apiClient().getNonces({
    organizationId,
    address: ownerAddress,
    caip2: network.caip2,
    nonce: sponsor ? false : true,
    gasStationNonce: sponsor ? true : false,
  });
  const { nonce } = resp;
  const { gasStationNonce } = resp;
  // Submit transaction via Turnkey
  const { sendTransactionStatusId } = await turnkey
    .apiClient()
    .ethSendTransaction({
      organizationId,
      from: ownerAddress,
      to: destination,
      gasStationNonce: sponsor ? gasStationNonce : undefined,
      nonce: sponsor ? undefined : nonce,
      sponsor,
      caip2: network.caip2,
      value: value.toString(),
      gasLimit: sponsor ? undefined : gas.toString(),
      maxFeePerGas: sponsor ? undefined : maxFee!.toString(),
      maxPriorityFeePerGas: sponsor ? undefined : maxPriorityFee!.toString(),
    });
  // Poll for final inclusion
  const status = await pollTransactionStatus({
    apiClient: turnkey.apiClient(),
    organizationId,
    sendTransactionStatusId,
  });

  if (status.txStatus !== "INCLUDED") {
    throw new Error(`ETH sweep failed with status: ${status.txStatus}`);
  }

  console.log(`Sent ETH: ${network.explorerBaseUrl}/tx/${status.eth?.txHash}`);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
