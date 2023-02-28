import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { createNewEthereumPrivateKey } from "./createNewEthereumPrivateKey";
import WETH_TOKEN_ABI from "./weth-contract-abi.json";

const WETH_TOKEN_ADDRESS_GOERLI = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";

async function main() {
  if (!process.env.PRIVATE_KEY_ID) {
    // If you don't specify a `PRIVATE_KEY_ID`, we'll create one for you via calling the Turnkey API.
    await createNewEthereumPrivateKey();
    return;
  }

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
    organizationId: process.env.ORGANIZATION_ID!,
    privateKeyId: process.env.PRIVATE_KEY_ID!,
  });

  // Connect it with a Provider (https://docs.ethers.org/v5/api/providers/)
  const network = "goerli";
  const provider = new ethers.providers.InfuraProvider(network);
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = await connectedSigner.getChainId();
  const address = await connectedSigner.getAddress();
  const balance = await connectedSigner.getBalance();
  const transactionCount = await connectedSigner.getTransactionCount();
  const transactionAmount = "0.00001";
  const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.utils.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);

  // Create a simple send transaction
  const transactionRequest = {
    to: destinationAddress,
    value: ethers.utils.parseEther(transactionAmount),
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

  // 1. Simple send tx
  const sentTx = await connectedSigner.sendTransaction(transactionRequest);

  print(
    `Sent ${ethers.utils.formatEther(sentTx.value)} Ether to ${sentTx.to}:`,
    `https://${network}.etherscan.io/tx/${sentTx.hash}`
  );

  if (network === "goerli") {
    // https://goerli.etherscan.io/address/0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6
    const wethContract = new ethers.Contract(
      WETH_TOKEN_ADDRESS_GOERLI,
      WETH_TOKEN_ABI,
      connectedSigner
    );

    const wethBalance = await wethContract.balanceOf(address);

    print("WETH Balance:", `${ethers.utils.formatEther(wethBalance)} WETH`);

    // 2. Wrap ETH --> WETH
    const depositTx = await wethContract.deposit({
      value: ethers.utils.parseEther(transactionAmount),
    });

    print(
      `Wrapped ${ethers.utils.formatEther(depositTx.value)} ETH:`,
      `https://${network}.etherscan.io/tx/${depositTx.hash}`
    );

    // 3. Unwrap WETH --> ETH
    const withdrawTx = await wethContract.withdraw(
      ethers.utils.parseEther(transactionAmount)
    );

    print(
      `Unwrapped ${transactionAmount} WETH:`,
      `https://${network}.etherscan.io/tx/${withdrawTx.hash}`
    );

    // 4. Transfer WETH
    const transferTx = await wethContract.transfer(
      destinationAddress,
      ethers.utils.parseEther(transactionAmount)
    );

    print(
      `Sent ${transactionAmount} WETH to ${destinationAddress}:`,
      `https://${network}.etherscan.io/tx/${transferTx.hash}`
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
