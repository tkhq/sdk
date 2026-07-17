import { printPosition } from "./util";

/** Print the wallet's current Aave v3 position and liquid USDC balance. */
async function main() {
  await printPosition("positions");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
