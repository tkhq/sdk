import * as path from "path";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { toReadableAmount, isKeyOfObject } from "./utils";
import { getOrganization, createPrivateKey, createPrivateKeyTag, createUser, createUserTag, createPolicy } from "./requests";
import { TurnkeyApi, init as httpInit } from "@turnkey/http";
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
        "fund": fund,
    };

    if (!isKeyOfObject(command, commands)) {
        throw new Error(`Unknown command: ${command}`);
    }

    commands[command](args.slice(1));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

// TODO(tim): pass options (e.g. "X" source private keys)
async function setup(args: string[]) {
    // setup user tags
    const adminTagId = await createUserTag("Admin", []);
    const managerTagId = await createUserTag("Manager", []);
    const executorTagId = await createUserTag("Executor", []);

    // setup users
    await createUser("Alice", [adminTagId], "Alice key", "02f1a1f1a30b4bffa3fb757714e79ceec0ec68af233985097aff2bd9cc96808728");
    await createUser("Bob", [managerTagId], "Bob key", "038a20d6caec750413844bdc9fec964dfa0a153f66dd4152c3c44454a2cc973436");
    await createUser("Phil", [executorTagId], "Phil key", "0270b604a368191d94417a6b8a4ff27af7cbec944ab84ef6cd7f48edd9cd0f04fe");

    // setup private key tags
    const bankTagId = await createPrivateKeyTag("Bank", []);
    const sinkTagId = await createPrivateKeyTag("Sink", []);
    const sourceTagId = await createPrivateKeyTag("Source", []);

    // setup private keys
    await createPrivateKey("Bank key", [bankTagId]);
    await createPrivateKey("Sink key", [sinkTagId]);
    await createPrivateKey("Source key 1", [sourceTagId]);
    await createPrivateKey("Source key 2", [sourceTagId]);
    await createPrivateKey("Source key 3", [sourceTagId]);

    // setup policies
    // TODO(tim): tighten policies to enforce keys can only send to specific addresses
    await createPolicy("Admin users can do everything", "EFFECT_ALLOW", `approvers.any(user, user.tags.contains('${adminTagId}'))`, "true");
    await createPolicy("Manager users can use Sink keys", "EFFECT_ALLOW", `approvers.any(user, user.tags.contains('${managerTagId}'))`, `private_key.tags.contains('${sinkTagId}')`);
    await createPolicy("Executor users can use Source keys", "EFFECT_ALLOW", `approvers.any(user, user.tags.contains('${executorTagId}'))`, `private_key.tags.contains('${sourceTagId}')`);
}

async function fund(args: string[]) {
    const organization = await getOrganization();
    console.log(organization)
}
