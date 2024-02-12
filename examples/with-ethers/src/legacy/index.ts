import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { createNewEthereumPrivateKey } from "./createNewEthereumPrivateKey";
import { print, assertEqual } from "../util";
import WETH_TOKEN_ABI from "../weth-contract-abi.json";

const WETH_TOKEN_ADDRESS_GOERLI = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";

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

  // Initialize a Turnkey Signer with a private key ID
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.PRIVATE_KEY_ID!,
  });

  // Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v6/api/providers/)
  const network = "goerli";
  const provider = new ethers.InfuraProvider(network);
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = (await connectedSigner.provider?.getNetwork())?.chainId;
  const address = await connectedSigner.getAddress();
  const balance = (await connectedSigner.provider?.getBalance(address)) ?? 0;
  const transactionCount = await connectedSigner.provider?.getTransactionCount(
    address
  );

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);

  // 1. Sign a raw payload (`eth_sign` style)
  const message = "Hello Turnkey";
  const signature = await connectedSigner.signMessage(message);
  const recoveredAddress = ethers.verifyMessage(message, signature);

  print("Turnkey-powered signature:", `${signature}`);
  print("Recovered address:", `${recoveredAddress}`);
  assertEqual(recoveredAddress, address);

  // Create a simple send transaction
  const transactionAmount = "0.00001";
  const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";
  const transactionRequest = {
    to: destinationAddress,
    value: ethers.parseEther(transactionAmount),
    type: 2,
  };

  const signedTx = await connectedSigner.signTransaction(transactionRequest);

  print("Turnkey-signed transaction:", `${signedTx}`);

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

  // 2. Simple send tx
  const sentTx = await connectedSigner.sendTransaction(transactionRequest);

  print(
    `Sent ${ethers.formatEther(sentTx.value)} Ether to ${sentTx.to}:`,
    `https://${network}.etherscan.io/tx/${sentTx.hash}`
  );

  if (network === "goerli") {
    // https://goerli.etherscan.io/address/0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6
    const wethContract = new ethers.Contract(
      WETH_TOKEN_ADDRESS_GOERLI,
      WETH_TOKEN_ABI,
      connectedSigner
    );

    // Read from contract
    const wethBalance = await wethContract?.balanceOf?.(address);

    print("WETH Balance:", `${ethers.formatEther(wethBalance)} WETH`);

    // 3. Wrap ETH -> WETH
    const depositTx = await wethContract?.deposit?.({
      value: ethers.parseEther(transactionAmount),
    });

    print(
      `Wrapped ${ethers.formatEther(depositTx.value)} ETH:`,
      `https://${network}.etherscan.io/tx/${depositTx.hash}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
