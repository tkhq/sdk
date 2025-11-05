import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main () {

  const res = await fetch(
  'https://api.yield.xyz/v1/yields?network=base&token=USDC&limit=10',
  { headers: { 'X-API-KEY': process.env.YIELD_API_KEY! } }
);
const result = (await res.json()) as any; 
const items = result.items 

// pick one yield
const selected = items[0];
const YIELD_ID = selected.id;

// metadata is included in the object
const apy = selected.rewardRate;
const token = selected.token;
const metadata = selected.metadata;

  console.log({YIELD_ID, apy, token, metadata})

}

main()