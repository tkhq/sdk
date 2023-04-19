import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

export async function generateKeyPairWithOpenSsl(): Promise<{
  privateKey: string;
  publicKey: string;
  pemPublicKey: string;
}> {
  const tmpFolder = await fs.promises.mkdtemp(
    path.resolve(os.tmpdir(), "stamp-")
  );

  async function contextualExec(command: string): Promise<string> {
    return (
      await execAsync(command, {
        cwd: tmpFolder,
        encoding: "utf-8",
      })
    ).stdout;
  }

  await contextualExec(
    "openssl ecparam -genkey -name prime256v1 -noout -out private_key.pem"
  );
  await contextualExec(
    "openssl ec -in private_key.pem -pubout -out public_key.pem"
  );
  const rawPrivateKey = await contextualExec(
    "openssl ec -in private_key.pem -noout -text"
  );
  const rawPublicKey = await contextualExec(
    "openssl ec -pubin -in public_key.pem -conv_form compressed -noout -text"
  );

  const privateKey = rawPrivateKey
    .split("\n")
    .slice(2, 5)
    .map((line) => line.replace(/:/g, "").trim())
    .join("");

  const publicKey = rawPublicKey
    .split("\n")
    .slice(2, 5)
    .map((line) => line.replace(/:/g, "").trim())
    .join("");

  const pemPublicKey = (
    await fs.promises.readFile(
      path.resolve(tmpFolder, "public_key.pem"),
      "utf-8"
    )
  ).trim();

  await fs.promises.rm(tmpFolder, { recursive: true, force: true });

  return { privateKey, publicKey, pemPublicKey };
}
