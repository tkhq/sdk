import * as fs from "fs";
import * as path from "path";
import { generateP256KeyPair } from "@turnkey/crypto";

// Setup step: generates a P-256 API key pair and writes both halves straight
// into .env.local, so the private key is never printed or copied by hand.
// Only the public key is shown. The key isn't registered in any org yet;
// `pnpm onboard-customer` adds it to the customer's sub-org.
//
// Usage: pnpm keygen [customer|delegated]   (default: customer)
//
// It refuses to replace a key that's already set.

const TARGETS = {
  customer: "CUSTOMER_API",
  delegated: "DELEGATED_API",
} as const;

function main() {
  const which = (process.argv[2] ?? "customer").toLowerCase();
  if (!(which in TARGETS)) {
    throw new Error(`usage: pnpm keygen [customer|delegated]`);
  }
  const prefix = TARGETS[which as keyof typeof TARGETS];

  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(path.resolve(process.cwd(), ".env.local.example"), envPath);
    console.log("Created .env.local from .env.local.example");
  }

  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  const isSet = (name: string) => {
    const line = lines.find((l) => l.startsWith(`${name}=`));
    const value = line
      ?.slice(name.length + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    return !!value && !value.startsWith("your_");
  };
  for (const name of [`${prefix}_PUBLIC_KEY`, `${prefix}_PRIVATE_KEY`]) {
    if (isSet(name)) {
      throw new Error(
        `${name} is already set in .env.local; clear it first if you want a new key`,
      );
    }
  }

  const { publicKey, privateKey } = generateP256KeyPair();
  const values: Record<string, string> = {
    [`${prefix}_PUBLIC_KEY`]: publicKey,
    [`${prefix}_PRIVATE_KEY`]: privateKey,
  };

  for (const [name, value] of Object.entries(values)) {
    const i = lines.findIndex((l) => l.startsWith(`${name}=`));
    if (i >= 0) lines[i] = `${name}=${value}`;
    else lines.push(`${name}=${value}`);
  }

  fs.writeFileSync(envPath, lines.join("\n"), { mode: 0o600 });
  fs.chmodSync(envPath, 0o600);

  console.log(
    `✅ Wrote a new ${which} key pair to .env.local (readable only by you)`,
  );
  console.log(`   ${prefix}_PUBLIC_KEY=${publicKey}`);
  console.log(`   ${prefix}_PRIVATE_KEY=(written, not shown)`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
