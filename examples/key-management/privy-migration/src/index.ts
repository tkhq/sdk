/**
 * privy-migration example entrypoint.
 *
 * Usage:
 *   pnpm start -- --chain evm --ownership app --mock
 *   pnpm start -- --chain solana --ownership user --mock
 *   pnpm start -- --chain evm --ownership app                    # live, app-owned
 *   pnpm start -- --chain evm --ownership user                   # live, user-owned (needs PRIVY_USER_JWT)
 *   pnpm start -- --chain evm --ownership quorum                 # live, 2-of-2 quorum
 *   pnpm start -- --chain evm --ownership app --wallet wa_xxx    # override wallet id
 *
 * Ownership modes:
 *   app     - wallet owned by the app / app-controlled authorization key.
 *             Fully UNATTENDED bulk migration. Zero end-user interaction.
 *   user    - user-owned embedded wallet. Login-triggered per user; needs
 *             the user's JWT in authorization_context.
 *   quorum  - 2-of-2 user + app. Login-triggered; app co-signs.
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
  describeOwnershipAuth,
  type Chain,
  type Ownership,
} from "./exportFromPrivy";
import { importPrivateKeyIntoTurnkey, turnkeyClient } from "./importToTurnkey";

type Args = {
  chain: Chain;
  ownership: Ownership;
  mock: boolean;
  wallet?: string;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { chain: "evm", ownership: "app", mock: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mock") out.mock = true;
    else if (a === "--chain") {
      const v = argv[++i];
      if (v !== "evm" && v !== "solana") {
        throw new Error(`--chain must be "evm" or "solana", got: ${v}`);
      }
      out.chain = v;
    } else if (a === "--ownership") {
      const v = argv[++i];
      if (v !== "app" && v !== "user" && v !== "quorum") {
        throw new Error(
          `--ownership must be "app", "user", or "quorum", got: ${v}`,
        );
      }
      out.ownership = v;
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
  --chain evm|solana       Which curve/address format to import as (default: evm)
  --ownership app|user|quorum
                           Privy wallet ownership model (default: app)
                             app     - app / authorization-key owned; unattended bulk
                             user    - user-owned; requires PRIVY_USER_JWT (login-triggered)
                             quorum  - 2-of-2 user+app; requires both
  --mock                   Skip the Privy call, generate a throwaway key locally,
                           and run only the Turnkey import path end-to-end.
  --wallet <id>            Override PRIVY_WALLET_ID from .env.local
  -h, --help               Show this help
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
    `[migration] chain=${args.chain} ownership=${args.ownership} mode=${
      args.mock ? "mock" : "live"
    }`,
  );
  console.log(
    `[migration] a live run in this mode would require: ${describeOwnershipAuth(
      args.ownership,
    )}`,
  );

  const exported = args.mock
    ? exportFromPrivyMock({ chain: args.chain, ownership: args.ownership })
    : await exportFromPrivyLive({
        chain: args.chain,
        ownership: args.ownership,
        appId: requireEnv("PRIVY_APP_ID"),
        appSecret: requireEnv("PRIVY_APP_SECRET"),
        walletId: args.wallet ?? requireEnv("PRIVY_WALLET_ID"),
        ...(process.env["PRIVY_AUTHORIZATION_PRIVATE_KEY"]
          ? {
              authorizationPrivateKeyRaw:
                process.env["PRIVY_AUTHORIZATION_PRIVATE_KEY"],
            }
          : {}),
        ...(process.env["PRIVY_USER_JWT"]
          ? { userJwt: process.env["PRIVY_USER_JWT"] }
          : {}),
      });

  // Deliberately do NOT log the plaintext. Log only its shape.
  console.log(
    `[migration] exported source=${exported.source} ownership=${exported.ownership} keyFormat=${exported.keyFormat} length=${exported.privateKey.length}`,
  );

  const privateKeyName = `privy-migrated-${args.chain}-${args.ownership}-${Date.now()}`;
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
    `[migration] done. Recommended next step: rotate/sweep old assets away from the Privy address (see README "Trust boundary").`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
