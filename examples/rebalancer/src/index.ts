import * as path from "path";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { toReadableAmount, isKeyOfObject } from "./utils";
import { getOrganization, createPrivateKey, createPrivateKeyTag, createUser, createUserTag, createPolicy } from "./requests";
import { TurnkeyApi, init as httpInit } from "@turnkey/http";
import { getProvider, getTurnkeySigner } from "./provider";

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
    await createPolicy("Admin users can do everything", "EFFECT_ALLOW", `approvers.any(user, user.tags.contains('${adminTagId}'))`, "true");
    await createPolicy("Manager users can use Sink keys", "EFFECT_ALLOW", `approvers.any(user, user.tags.contains('${managerTagId}'))`, `private_key.tags.contains('${sinkTagId}')`);
    await createPolicy("Executor users can use Source keys", "EFFECT_ALLOW", `approvers.any(user, user.tags.contains('${executorTagId}'))`, `private_key.tags.contains('${sourceTagId}')`);

    // TODO(tim): tighten policies to enforce keys can only send to specific addresses
}

// TODO(tim): pass options (e.g. source private keys, amount, etc)
async function fund(args: string[]) {
    const organization = await getOrganization();

    // find "Bank" private key
    const bankTag = organization.tags.find(tag => {
        const isPrivateKeyTag = tag.tagType == 'TAG_TYPE_PRIVATE_KEY';
        const isBankTag = tag.tagName == 'Bank';
        return isPrivateKeyTag && isBankTag;
    });

    const bankPrivateKey = organization.privateKeys.find(privateKey => {
        return privateKey.privateKeyTags.includes(bankTag.tagId)
    });

    // find "Source" private keys
    const sourceTag = organization.tags.find(tag => {
        const isPrivateKeyTag = tag.tagType == 'TAG_TYPE_PRIVATE_KEY';
        const isSourceTag = tag.tagName == 'Source';
        return isPrivateKeyTag && isSourceTag;
    });

    const sourcePrivateKeys = organization.privateKeys.filter(privateKey => {
        return privateKey.privateKeyTags.includes(sourceTag.tagId);
    });

    // send from "Bank" to "Source"
    const provider = getProvider();
    const connectedSigner = getTurnkeySigner(provider, bankPrivateKey.privateKeyId);

    for (const sourcePrivateKey of sourcePrivateKeys) {
        // get address
        const ethAddress = sourcePrivateKey.addresses.find(address => {
            return address.format == 'ADDRESS_FORMAT_ETHEREUM';
        });
        if (!ethAddress || !ethAddress.address) {
            throw new Error(`couldn't lookup ETH address for private key: ${sourcePrivateKey.privateKeyId}`)
        }

        // transfer eth
        await transferEth(provider, connectedSigner, ethAddress.address, 1);
    }
}

async function transferEth(
    provider: ethers.providers.Provider,
    connectedSigner: ethers.Signer,
    destinationAddress: string,
    value: number,
) {
  // TODO(tim): investigate why we can't call `connectedSigner.getNetwork()`
  const network = await provider.getNetwork();
  const chainId = await connectedSigner.getChainId();
  const balance = await connectedSigner.getBalance();
  const address = await connectedSigner.getAddress();

  print("Network:", `${network.name} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.utils.formatEther(balance)} Ether`);

  if (balance.isZero()) {
      let warningMessage = "The transaction won't be broadcasted because your account balance is zero.\n";
      if (network.name === "goerli") {
        warningMessage += "Use https://goerlifaucet.com/ to request funds on Goerli, then run the script again.\n";
      }

      throw new Error(warningMessage);
  }

  const feeData = await connectedSigner.getFeeData();
  const gasRequired = feeData.maxFeePerGas!.mul(21000);

  if (balance.lt(gasRequired.add(value))) {
    throw new Error(`Insufficient ETH balance. Skipping...`);
  }

  const transactionRequest = {
    to: destinationAddress,
    value,
    type: 2,
    maxFeePerGas: feeData.maxFeePerGas!,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas!,
  };

  const sentTx = await connectedSigner.sendTransaction(transactionRequest);
  console.log("Awaiting confirmation...");

  await connectedSigner.provider?.waitForTransaction(sentTx.hash, 1);

  print(
      `Sent ${toReadableAmount(
        value.toString(),
        18,
        12
      )} ETH to ${destinationAddress}:`,
      `https://${network.name}.etherscan.io/tx/${sentTx.hash}`
  );
}

function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}
