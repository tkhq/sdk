import { initSparkWalletFromEnv, env } from "./init";
import { createTurnkeyLightningInvoice } from "./turnkeyLightning";

function optionalInt(name: string): number | undefined {
  const val = process.env[name];
  if (!val) return undefined;
  const parsed = Number.parseInt(val, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function requiredPositiveInt(name: string, fallback: string): number {
  const parsed = Number.parseInt(env(name, fallback), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

async function main() {
  const { wallet, signer } = await initSparkWalletFromEnv(
    process.env.LIGHTNING_RECEIVER_ENV_PREFIX ?? "",
  );

  try {
    const invoiceParams: Parameters<typeof createTurnkeyLightningInvoice>[2] = {
      amountSats: requiredPositiveInt("LIGHTNING_AMOUNT_SATS", "1000"),
      memo: process.env.LIGHTNING_MEMO ?? "Turnkey Spark Lightning receive",
      includeSparkAddress:
        process.env.LIGHTNING_INCLUDE_SPARK_ADDRESS === "true",
      includeSparkInvoice:
        process.env.LIGHTNING_INCLUDE_SPARK_INVOICE === "true",
    };
    const expirySeconds = optionalInt("LIGHTNING_EXPIRY_SECONDS");
    if (expirySeconds !== undefined) {
      invoiceParams.expirySeconds = expirySeconds;
    }

    const invoice = await createTurnkeyLightningInvoice(
      wallet,
      signer,
      invoiceParams,
    );

    console.log("Lightning receive request created");
    console.log("Request ID:", invoice.id);
    console.log("Status:", invoice.status);
    console.log("Payment hash:", invoice.invoice.paymentHash);
    console.log("Invoice:", invoice.invoice.encodedInvoice);
  } finally {
    wallet.cleanupConnections();
  }
}

main().catch((err) => {
  console.error("lightning-receive failed:", err);
  process.exit(1);
});
