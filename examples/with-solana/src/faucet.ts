import * as solanaNetwork from "./utils/solanaNetwork";
import prompts from "prompts";

async function main() {
  const { solAddress } = await prompts([
    {
      type: "text",
      name: "solAddress",
      message: "Address to drop devnet tokens into:",
    },
  ]);
  const connection = solanaNetwork.connect();
  await solanaNetwork.dropTokens(connection, solAddress);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
