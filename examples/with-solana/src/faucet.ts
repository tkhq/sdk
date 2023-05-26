import * as solanaNetwork from "./solanaNetwork";
import { input } from "@inquirer/prompts";


async function main() {
  const solAddress = await input({ message: "Address to drop devnet tokens into:" });
  const connection = solanaNetwork.connect();
  await solanaNetwork.dropTokens(connection, solAddress);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
