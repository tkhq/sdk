import * as path from "path";
import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const network = "goerli";
  const provider = new ethers.providers.InfuraProvider(network);

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
    organizationId: process.env.ORGANIZATION_ID!,
    keyId: process.env.KEY_ID!,
  });

  // Connect it with a Provider (https://docs.ethers.org/v5/api/providers/)
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = await connectedSigner.getChainId();
  const address = await connectedSigner.getAddress();
  const balance = await connectedSigner.getBalance();
  const transactionCount = await connectedSigner.getTransactionCount();

  console.log(`Network\n\t${network} (chain ID ${chainId})`);
  console.log(`Address\n\t${address}`);
  console.log(`Balance\n\t${String(balance)}`);
  console.log(`Transaction count\n\t${transactionCount}`);

  const transactionRequest = {
    to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
    value: ethers.utils.parseEther("0.001"),
    type: 2,
  };

  const signedTx = await connectedSigner.signTransaction(transactionRequest);

  console.log(`Signed transaction\n\t${signedTx}`);

  if (balance.isZero()) {
    let warningMessage =
      "\nWarning: the transaction won't be broadcasted because your account balance is zero.\n";
    if (network === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on Goerli, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  const sentTx = await connectedSigner.sendTransaction(transactionRequest);

  console.log(
    `Transaction sent!\n\thttps://${network}.etherscan.io/tx/${sentTx.hash}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
