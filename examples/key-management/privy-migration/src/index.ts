/**
 * privy-migration example entrypoint.
 *
 * Usage:
 *   pnpm start -- --chain evm --mock              # no Privy account needed
 *   pnpm start -- --chain solana --mock
 *   pnpm start -- --chain evm                     # live: uses PRIVY_* env
 *   pnpm start -- --chain solana --wallet wa_xyz  # override PRIVY_WALLET_ID
 *
 * This example wires:
 *   Privy export (HPKE) --> in-process plaintext --> Turnkey import (HPKE)
 *
 * The plaintext private key exists in this Node process's heap between
 * the Privy decrypt and the Turnkey re-encrypt. It is never written to
 * disk, never logged, and (in the live path) the byte buffer holding the
 * decrypted bytes is zeroed as soon as it is re-encoded. See the README
 * ("Trust boundary") for the full accounting and mitigations.
 */

import * as path from "path";
import * as dotenv from "dotenv";
import { Crypto } from "@peculiar/webcrypto";

if (typeof globalThis.crypto === "undefined") {
  // Node 18 has WebCrypto globally; this polyfill covers older runtimes
  // and matches the sibling `import-in-node` example.
  (globalThis as unknown as { crypto: Crypto }).crypto = new Crypto();
}

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  exportFromPrivyLive,
  exportFromPrivyMock,
  type Chain,
} from "./exportFromPrivy";
import {
  importPrivateKeyIntoTurnkey,
  turnkeyClient,
} from "./importToTurnkey";

type Args = {
  chain: Chain;
  mock: boolean;
  wallet?: string;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { chain: "evm", mock: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mock") out.mock = true;
    else if (a === "--chain") {
      const v = argv[++i];
      if (v !== "evm" && v !== "solana") {
        throw new Error(`--chain must be "evm" or "solana", got: ${v}`);
      }
      out.chain = v;
    } else if (a === "--wallet") {
      const v = argv[++i];
      if (v) out.wallet = v;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(`privy-migration - migrate a Privy embedded wallet key into Turnkey.

Flags:
  --chain evm|solana   Which curve/address format to import as (default: evm)
  --mock               Skip the Privy call, generate a throwaway key locally,
                       and run only the Turnkey import path end-to-end.
  --wallet <id>        Override PRIVY_WALLET_ID from .env.local
  -h, --help           Show this help
`);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const client = turnkeyClient({
    apiBaseUrl: requireEnv("BASE_URL"),
    apiPublicKey: requireEnv("API_PUBLIC_KEY"),
    apiPrivateKey: requireEnv("API_PRIVATE_KEY"),
    organizationId: requireEnv("ORGANIZATION_ID"),
  });
  const organizationId = requireEnv("ORGANIZATION_ID");
  const userId = requireEnv("USER_ID");

  console.log(
    `[migration] chain=${args.chain} mode=${args.mock ? "mock" : "live"}`,
  );

  const exported = args.mock
    ? exportFromPrivyMock(args.chain)
    : await exportFromPrivyLive({
        chain: args.chain,
        appId: requireEnv("PRIVY_APP_ID"),
        appSecret: requireEnv("PRIVY_APP_SECRET"),
        walletId: args.wallet ?? requireEnv("PRIVY_WALLET_ID"),
      });

  // Deliberately do NOT log the plaintext. Log only its shape.
  console.log(
    `[migration] exported source=${exported.source} keyFormat=${exported.keyFormat} length=${exported.privateKey.length}`,
  );

  const privateKeyName = `privy-migrated-${args.chain}-${Date.now()}`;
  const result = await importPrivateKeyIntoTurnkey({
    client,
    organizationId,
    userId,
    privateKeyName,
    chain: args.chain,
    privateKey: exported.privateKey,
    keyFormat: exported.keyFormat,
  });

  console.log(`[migration] imported privateKeyId=${result.privateKeyId}`);
  for (const a of result.addresses) {
    console.log(`[migration]   address (${a.format}): ${a.address}`);
  }
  console.log(
    `[migration] done. Next step: rotate/sweep old assets away from the Privy address (see README).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
