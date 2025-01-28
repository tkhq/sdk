import * as fs from "fs";
import * as path from "path";

const FIXTURES_DIR = path.resolve(__dirname, "..", "__fixtures__");

export async function readFixture(): Promise<{
  privateKey: string;
  publicKey: string;
  pemPublicKey: string;
}> {
  const privateKey = (
    await fs.promises.readFile(
      path.resolve(FIXTURES_DIR, "api-key.private"),
      "utf-8"
    )
  ).trim();

  // These two formats represent the same public key
  const publicKey = (
    await fs.promises.readFile(
      path.resolve(FIXTURES_DIR, "api-key.public"),
      "utf-8"
    )
  ).trim();
  const pemPublicKey = (
    await fs.promises.readFile(
      path.resolve(FIXTURES_DIR, "api-key.public.pem"),
      "utf-8"
    )
  ).trim();

  return {
    privateKey,
    publicKey,
    pemPublicKey,
  };
}
