import * as path from "path";
import * as dotenv from "dotenv";
// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const turnkeyAccount = {
  address: process.env.TURNKEY_WALLET_ADDRESS!,
};
console.log(turnkeyAccount);

async function main() {
  const balanceRes = await fetch(
    `https://api.yield.xyz/v1/yields/${process.env.YIELD_ID}/balances`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.YIELD_API_KEY!,
      },
      body: JSON.stringify({ address: turnkeyAccount.address }),
    },
  );
  const balances = await balanceRes.json();
  console.log("Vault balances:", JSON.stringify(balances, null, 2));
}

main();
