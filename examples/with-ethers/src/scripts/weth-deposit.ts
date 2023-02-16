import { ethers } from "ethers";
import { createNewEthereumPrivateKey } from "../createNewEthereumPrivateKey";
import { WETH_ABI, WETH_TOKEN_GOERLI } from "../constants";
import { getProvider, getTurnkeySigner } from "../provider";

async function main() {
  if (!process.env.PRIVATE_KEY_ID) {
    // If you don't specify a `PRIVATE_KEY_ID`, we'll create one for you via calling the Turnkey API.
    await createNewEthereumPrivateKey();
    return;
  }

  const provider = getProvider();
  const connectedSigner = getTurnkeySigner();

  const network = await provider.getNetwork();
  const chainId = await connectedSigner.getChainId();
  const address = await connectedSigner.getAddress();
  const balance = await connectedSigner.getBalance();
  const transactionCount = await connectedSigner.getTransactionCount();
  const transactionAmount = "0.00001";

  print("Network:", `${network.name} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.utils.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);

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

  if (network.name === "goerli") {
    // https://goerli.etherscan.io/address/0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6
    const wethContract = new ethers.Contract(
      WETH_TOKEN_GOERLI.address,
      WETH_ABI,
      connectedSigner
    );

    const wethBalance = await wethContract.balanceOf(address);

    print("WETH Balance:", `${ethers.utils.formatEther(wethBalance)} WETH`);

    // Convert ETH --> WETH
    const depositTx = await wethContract.deposit({
      value: ethers.utils.parseEther(transactionAmount),
    });

    print(
      `Wrapped ${ethers.utils.formatEther(depositTx.value)} ETH:`,
      `https://${network.name}.etherscan.io/tx/${depositTx.hash}`
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
