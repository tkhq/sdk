import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { showMainMenu, promptContinue } from "./cli/menu";
import { error, printHeader } from "./cli/display";
import { runFullDemo } from "./commands/fullDemo";
import { runCreateMerchant } from "./commands/createMerchant";
import { runListMerchants } from "./commands/listMerchants";
import { runAddMerchantWallet } from "./commands/addMerchantWallet";
import { runDeleteMerchant } from "./commands/deleteMerchant";
import { runSweepFunds } from "./commands/sweepFunds";
import { runCheckBalance } from "./commands/checkBalance";
import chalk from "chalk";

async function main() {
  // Validate required environment variables
  const requiredEnvVars = ["API_PUBLIC_KEY", "API_PRIVATE_KEY", "ORGANIZATION_ID", "INFURA_KEY"];
  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingVars.length > 0) {
    error("Missing required environment variables:");
    missingVars.forEach((envVar) => {
      console.log(chalk.red(`   - ${envVar}`));
    });
    console.log(chalk.gray("   Please set them in .env.local"));
    if (missingVars.includes("INFURA_KEY")) {
      console.log(chalk.gray("   Get your Infura key at: https://www.infura.io/"));
    }
    process.exit(1);
  }

  // Clear screen and show header
  console.clear();
  printHeader("Payflow Demo - Interactive CLI");
  console.log();

  // Main menu loop
  while (true) {
    const action = await showMainMenu();

    if (!action || action === "exit") {
      console.log(chalk.gray("\nGoodbye!\n"));
      break;
    }

    try {
      switch (action) {
        case "full-demo":
          await runFullDemo();
          break;

        case "create-merchant":
          await runCreateMerchant();
          break;

        case "list-merchants":
          await runListMerchants();
          break;

        case "add-merchant-wallet":
          await runAddMerchantWallet();
          break;

        case "delete-merchant":
          await runDeleteMerchant();
          break;

        case "sweep-funds":
          await runSweepFunds();
          break;

        case "check-balance":
          await runCheckBalance();
          break;

        default:
          error(`Unknown action: ${action}`);
      }

      // Ask if user wants to continue
      const shouldContinue = await promptContinue();
      if (!shouldContinue) {
        console.log(chalk.gray("\nGoodbye!\n"));
        break;
      }

      console.log(); // Add spacing before next menu
    } catch (err: any) {
      error(`Error: ${err.message || err}`);
      console.log();

      // Ask if user wants to continue after error
      const shouldContinue = await promptContinue();
      if (!shouldContinue) {
        console.log(chalk.gray("\nGoodbye!\n"));
        break;
      }
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
