import { readFile } from "node:fs/promises";
import { verifyReceipt, type Receipt } from "./verification";

async function main() {
  const [path, expectedServerDid] = process.argv.slice(2);
  if (!path || !expectedServerDid)
    throw new Error("Usage: pnpm verify <receipt.json> <expected-server-did>");
  const body = await readFile(path);
  if (body.length > 256 * 1024) throw new Error("Receipt exceeds 256 KiB.");
  const result = await verifyReceipt(
    JSON.parse(body.toString()) as Receipt,
    expectedServerDid,
  );
  console.log(JSON.stringify(result));
  if (!result.valid) process.exitCode = 1;
}

main().catch(() => {
  console.error(
    "Could not verify the receipt against the expected server DID.",
  );
  process.exitCode = 1;
});
