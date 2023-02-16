import { ethers } from "ethers";
import { createNewEthereumPrivateKey } from "../createNewEthereumPrivateKey";
import { getProvider, getTurnkeySigner } from "../provider";

async function main() {
  if (!process.env.KEY_ID) {
    // If you don't specify a `KEY_ID`, we'll create one for you via calling the Turnkey API.
    await createNewEthereumPrivateKey();
    return;
  }

  // Connect it with a Provider (https://docs.ethers.org/v5/api/providers/)
  const provider = getProvider();
  const connectedSigner = getTurnkeySigner();

  const network = await provider.getNetwork();
  const chainId = await connectedSigner.getChainId();
  const address = await connectedSigner.getAddress();
  const balance = await connectedSigner.getBalance();
  const transactionCount = await connectedSigner.getTransactionCount();
  const transactionAmount = "0.00001";
  const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";

  print("Network:", `${network.name} (chain ID ${chainId})`);
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
    if (network.name === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on Goerli, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  const sentTx = await connectedSigner.sendTransaction(transactionRequest);

  print(
    `Sent ${ethers.utils.formatEther(sentTx.value)} Ether to ${sentTx.to}:`,
    `https://${network.name}.etherscan.io/tx/${sentTx.hash}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}
