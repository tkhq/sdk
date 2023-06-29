import * as path from "path";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { toReadableAmount } from "./utils";
import { createPrivateKey, createPrivateKeyTag, createUser, createUserTag, createPolicy } from "./requests";
// import { getProvider, getTurnkeySigner } from "./provider";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
    const args = process.argv.slice(2);
    if (!args.length) {
        throw new Error('Command is required');
    }

    const command = args[0];
    const commands =  {
        "setup": setup,
    };

    if (!isKeyOfObject(command, commands)) {
        throw new Error(`Unknown command: ${command}`);
    }

    commands[command]();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function setup() {
    // await createUserTag("Admin", []);
    // await createUser("Bob", [], "demo1", "0307259bca7f4458fb62ab792eecc2a2b355a8387627b72f55e35e00abe07268f8");
    // await createPrivateKeyTag("Test", []);
    // await createPrivateKey("Best Key", []);
    // await createPolicy("Best Policy", "EFFECT_ALLOW", "true", "true");
}

export function isKeyOfObject<T>(
  key: string | number | symbol,
  obj: T,
): key is keyof T {
  return key in obj;
}
