import * as fs from "fs";
import * as path from "path";
import { generateP256KeyPair } from "@turnkey/crypto";

// One API key pair is generated for each demo user created by `pnpm cli setup`
const KEY_NAMES = ["alice", "bob"];
const KEYS_FILE = path.resolve(process.cwd(), "keys.local.json");

function main() {
  if (fs.existsSync(KEYS_FILE) && !process.argv.includes("--force")) {
    throw new Error(
      [
        `${KEYS_FILE} already exists.`,
        `Users created by a previous setup are tied to those keys, so they were left untouched.`,
        `Pass --force to overwrite them with new keys.`,
      ].join("\n"),
    );
  }

  const keys: { [key: string]: { [key: string]: string } } = {};
  for (const name of KEY_NAMES) {
    const { publicKey, privateKey } = generateP256KeyPair();
    keys[name] = { publicKey, privateKey };
  }

  // Readable by the current user only; this file holds private keys
  fs.writeFileSync(KEYS_FILE, `${JSON.stringify(keys, null, 2)}\n`, {
    mode: 0o600,
  });

  console.log(
    [
      `Generated API keys for: ${KEY_NAMES.join(", ")}`,
      `Saved to ${KEYS_FILE} (gitignored, do not commit or share it)`,
    ].join("\n"),
  );
}

main();
