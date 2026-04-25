/**
 * Create or inspect a native Spark wallet address.
 *
 * If NATIVE_SPARK_MNEMONIC is absent, the Spark SDK generates one and this
 * script prints it. Use the printed Spark address for the faucet baseline.
 */

import { initNativeSparkWallet } from "./init";

async function main() {
  const { wallet, mnemonic, network } = await initNativeSparkWallet({
    requireMnemonic: false,
  });

  try {
    const sparkAddress = await wallet.getSparkAddress();

    console.log(`Native Spark baseline (${network})`);
    console.log(`Spark address: ${sparkAddress}`);
    if (mnemonic) {
      console.log(`NATIVE_SPARK_MNEMONIC=${mnemonic}`);
    } else {
      console.log(`Using NATIVE_SPARK_MNEMONIC from the environment.`);
    }
  } finally {
    wallet.cleanupConnections();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
