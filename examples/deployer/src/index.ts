import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";
import { createNewWallet } from "./createNewWallet";
import compile from "./compile";
import { print } from "./util";

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewWallet();
    return;
  }

  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  // Connect it with a Provider (https://docs.ethers.org/v6/api/providers/)
  const network = "goerli";
  const connectedSigner = turnkeySigner.connect(
    new ethers.InfuraProvider(network)
  );

  const chainId = (await connectedSigner.provider?.getNetwork())?.chainId ?? 0;
  const address = await connectedSigner.getAddress();
  const balance = (await connectedSigner.provider?.getBalance(address)) ?? 0;

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.formatEther(balance)} Ether`);

  if (balance === 0) {
    let warningMessage =
      "The transaction won't be broadcasted because your account balance is zero.\n";
    if (network === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on Goerli, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  // See `compile.ts` to configure the compilation
  const compiled = compile();
  const abi = compiled.abi;
  const bytecode = compiled.evm.bytecode.object;

  // The factory we use for deploying contracts
  const factory = new ethers.ContractFactory(abi, bytecode, connectedSigner);

  // Deploy an instance of the contract
  const contract = await factory.deploy();

  // The address is available immediately, but the contract is NOT deployed yet
  print("Contract address", await contract.getAddress());

  const deploymentTransaction = await contract.deploymentTransaction();

  print(
    `Contract has been deployed:`,
    `https://${network}.etherscan.io/tx/${deploymentTransaction?.hash}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
