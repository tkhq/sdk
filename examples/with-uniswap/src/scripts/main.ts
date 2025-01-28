import { ethers } from "ethers";
import { createV3Trade, executeTrade } from "../base";
import { getProvider, getTurnkeySigner } from "../provider";

async function main() {
  if (!process.env.PRIVATE_KEY_ID) {
    console.log("Missing PRIVATE_KEY_ID");
    return;
  }

  const provider = getProvider();
  const connectedSigner = getTurnkeySigner(provider);

  print(
    "Connected Turnkey signer to provider:",
    `${JSON.stringify(connectedSigner)}`
  );

  const network = await provider.getNetwork();
  const chainId = (await connectedSigner.provider?.getNetwork())?.chainId ?? 0;
  const address = await connectedSigner.getAddress();
  const balance = (await connectedSigner.provider?.getBalance(address)) ?? 0;
  const transactionCount = await connectedSigner.provider?.getTransactionCount(
    address
  );

  // Print relevant config + address info
  print("Network:", `${network.name} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);

  if (network.name === "goerli") {
    // Construct uniswap v3 trade
    // TODO: Verify token balances before attempting trades

    // See `config.ts` to configure the trade
    let trade = await createV3Trade();

    print("Successfully prepared trade:", `${JSON.stringify(trade)}`);

    let result = await executeTrade(trade);

    print(
      `Successfully executed trade via Uniswap v3:`,
      `https://${network.name}.etherscan.io/tx/${result.hash}`
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
