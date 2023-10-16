import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { createNewEthereumPrivateKey } from "./createNewEthereumPrivateKey";
import compile from "./compile";

async function main() {
  if (!process.env.PRIVATE_KEY_ID) {
    // If you don't specify a `PRIVATE_KEY_ID`, we'll create one for you via calling the Turnkey API.
    await createNewEthereumPrivateKey();
    return;
  }

  const turnkeyClient = new TurnkeyClient(
    {
      baseUrl: process.env.BASE_URL!,
    },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    privateKeyId: process.env.PRIVATE_KEY_ID!,
  });

  // Connect it with a Provider (https://docs.ethers.org/v6/api/providers/)
  const network = "goerli";
  const provider = new ethers.InfuraProvider(network);
  const connectedSigner = turnkeySigner.connect(provider);
  
  const connectedNetwork = await turnkeySigner.provider!.getNetwork();
  const chainId = connectedNetwork.chainId;
  const address = await connectedSigner.getAddress();
  const balance = await connectedSigner.provider!.getBalance(address);

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.formatEther(balance)} Ether`);

  if (balance === 0n) {
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
  const contractAddress = await contract.getAddress();
  const transaction = await contract.deploymentTransaction();

  // The address is available immediately, but the contract is NOT deployed yet
  print("Contract address", contractAddress);

  await contract.waitForDeployment();

  print(
    `Contract has been deployed:`,
    `https://${network}.etherscan.io/tx/${transaction?.hash}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}
