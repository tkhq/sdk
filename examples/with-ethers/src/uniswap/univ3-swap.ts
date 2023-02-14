import * as path from "path";
import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { createNewEthereumPrivateKey } from "../createNewEthereumPrivateKey";
import ABI from "./uniswap-universal-router-contract-abi.json";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  if (!process.env.KEY_ID) {
    // If you don't specify a `KEY_ID`, we'll create one for you via calling the Turnkey API.
    await createNewEthereumPrivateKey();
    return;
  }

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
    organizationId: process.env.ORGANIZATION_ID!,
    keyId: process.env.KEY_ID!,
  });

  // Connect it with a Provider (https://docs.ethers.org/v5/api/providers/)
  const network = "goerli";
  const provider = new ethers.providers.InfuraProvider(network);
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = await connectedSigner.getChainId();
  const address = await connectedSigner.getAddress();
  const balance = await connectedSigner.getBalance();
  const transactionCount = await connectedSigner.getTransactionCount();

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.utils.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);

  const transactionRequest = {
    to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
    value: ethers.utils.parseEther("0.00001"),
    type: 2,
  };

  const signedTx = await connectedSigner.signTransaction(transactionRequest);

  print("Turnkey-signed transaction:", `${signedTx}`);

  if (balance.isZero()) {
    let warningMessage =
      "The transaction won't be broadcasted because your account balance is zero.\n";
    if (network === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on Goerli, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  const sentTx = await connectedSigner.sendTransaction(transactionRequest);

  print(
    `Sent ${ethers.utils.formatEther(sentTx.value)} Ether to ${sentTx.to}:`,
    `https://${network}.etherscan.io/tx/${sentTx.hash}`
  );

  if (network === "goerli") {
    // https://goerli.etherscan.io/address/0x4648a43b2c14da09fdf82b161150d3f634f40491
    const uniswapUniversalRouter = new ethers.Contract(
      "0x4648a43b2c14da09fdf82b161150d3f634f40491",
      ABI,
      connectedSigner
    );

    const wethBalance = await uniswapUniversalRouter.execute(address);

    print("WETH Balance:", `${ethers.utils.formatEther(wethBalance)} WETH`);

    const depositTx = await uniswapUniversalRouter.deposit({
      value: ethers.utils.parseEther("0.00001"),
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
