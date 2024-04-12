import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { createNewWallet } from "./createNewWallet";
import WETH_TOKEN_ABI from "./weth-contract-abi.json";

const WETH_TOKEN_ADDRESS_SEPOLIA = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewWallet();
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
    signWith: process.env.SIGN_WITH!,
  });

  // Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v5/api/providers/)
  const network = "sepolia";
  const provider = new ethers.providers.InfuraProvider(network);
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = await connectedSigner.getChainId();
  const address = await connectedSigner.getAddress();
  const balance = await connectedSigner.getBalance();
  const transactionCount = await connectedSigner.getTransactionCount();
  const gasPrice = await connectedSigner.getGasPrice();

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.utils.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);

  // 1. Create a legacy, EIP-155 (replay attack-preventing) send transaction
  const transactionAmount = "0.00001";
  const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";
  const transactionRequest = {
    chainId: chainId,
    nonce: transactionCount,
    to: destinationAddress,
    gasLimit: 21000,
    gasPrice: gasPrice,
    value: ethers.utils.parseEther(transactionAmount),
    data: "0x",
    type: 0,
  };

  const signedTx = await connectedSigner.signTransaction(transactionRequest);

  print("Turnkey-signed transaction:", `${signedTx}`);

  if (balance.isZero()) {
    let warningMessage =
      "The transaction won't be broadcasted because your account balance is zero.\n";
    if (network === "sepolia") {
      warningMessage +=
        "Use https://sepoliafaucet.com/ to request funds on Sepolia, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  const sentTx = await connectedSigner.sendTransaction(transactionRequest);

  print(
    `Sent ${ethers.utils.formatEther(sentTx.value)} Ether to ${sentTx.to}:`,
    `https://${network}.etherscan.io/tx/${sentTx.hash}`
  );

  if (network === "sepolia") {
    // https://sepolia.etherscan.io/address/0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9
    const wethContract = new ethers.Contract(
      WETH_TOKEN_ADDRESS_SEPOLIA,
      WETH_TOKEN_ABI,
      connectedSigner
    );

    // Read from contract
    const wethBalance = await wethContract.balanceOf(address);

    print("WETH Balance:", `${ethers.utils.formatEther(wethBalance)} WETH`);

    // 2. Wrap ETH -> WETH
    const depositTx = await wethContract.deposit({
      value: ethers.utils.parseEther(transactionAmount),
    });

    print(
      `Wrapped ${ethers.utils.formatEther(depositTx.value)} ETH:`,
      `https://${network}.etherscan.io/tx/${depositTx.hash}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}
