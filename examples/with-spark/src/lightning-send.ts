import { initSparkWalletFromEnv, requireEnv, env } from "./init";
import { turnkeyPayLightningInvoice } from "./internal/turnkeyLightning";

function optionalPositiveInt(name: string): number | undefined {
  const val = process.env[name];
  if (!val) return undefined;
  const parsed = Number.parseInt(val, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
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
    process.env.LIGHTNING_SENDER_ENV_PREFIX ?? "",
  );

  try {
    const sendParams: Parameters<typeof turnkeyPayLightningInvoice>[2] = {
      invoice: requireEnv("LIGHTNING_INVOICE"),
      maxFeeSats: requiredPositiveInt("LIGHTNING_MAX_FEE_SATS", "1000"),
    };
    const amountSatsToSend = optionalPositiveInt(
      "LIGHTNING_AMOUNT_SATS_TO_SEND",
    );
    if (amountSatsToSend !== undefined) {
      sendParams.amountSatsToSend = amountSatsToSend;
    }
    if (process.env.LIGHTNING_IDEMPOTENCY_KEY) {
      sendParams.idempotencyKey = process.env.LIGHTNING_IDEMPOTENCY_KEY;
    }

    const response = await turnkeyPayLightningInvoice(
      wallet,
      signer,
      sendParams,
    );

    console.log("Lightning send requested");
    console.log(JSON.stringify(response, null, 2));
  } finally {
    wallet.cleanupConnections();
  }
}

main().catch((err) => {
  console.error("lightning-send failed:", err);
  process.exit(1);
});
