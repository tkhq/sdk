process.env.DOTENV_CONFIG_PATH ??= ".env.local";
await import("dotenv/config");
import { getAllocation, turnkeyClient } from "../src/lib/turnkey-server";

async function main() {
  const subOrgId = process.argv[2];
  if (!subOrgId) throw new Error("usage: pnpm attack -- <subOrgId> [solanaAddress]");
  const organization = await getAllocation(subOrgId);
  const signWith = process.argv[3] ?? organization.wallets?.[0]?.accounts?.[0]?.address;
  if (!signWith) throw new Error("allocation has no wallet account");
  try {
    await turnkeyClient(subOrgId).signRawPayload({
      signWith,
      payload: "proof that the allocation backend cannot sign",
      encoding: "PAYLOAD_ENCODING_UTF8",
      hashFunction: "HASH_FUNCTION_SHA256",
    });
    console.error("SECURITY FAILURE: backend SIGN_RAW_PAYLOAD succeeded");
    process.exit(1);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`DENIED AS EXPECTED: ${reason}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
