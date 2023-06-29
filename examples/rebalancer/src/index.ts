import * as path from "path";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { toReadableAmount } from "./utils";
import { createPrivateKey, createPrivateKeyTag, createUser, createUserTag, createPolicy } from "./requests";
// import { getProvider, getTurnkeySigner } from "./provider";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
    // await createUserTag();
    // await createUser();
    // await createPrivateKeyTag();
    // await createPrivateKey();
    await createPolicy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
