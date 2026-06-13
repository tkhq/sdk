import * as path from "path";
import * as dotenv from "dotenv";
import { base } from "viem/chains";
import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import {
  createWalletClient,
  http,
  type Account,
  createPublicClient,
  parseAbi,
  parseUnits,
} from "viem";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MORPHO_VAULT_ADDRESS = process.env.MORPHO_VAULT_ADDRESS!;

async function main() {
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.TURNKEY_BASE_URL!,
    apiPrivateKey: process.env.NONROOT_API_PRIVATE_KEY!,
    apiPublicKey: process.env.NONROOT_API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  });

  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const client = createWalletClient({
    account: turnkeyAccount as Account,
    chain: base,
    transport: http(
      `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY!}`,
    ),
  });

  const publicClient = createPublicClient({
    transport: http(
      `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY!}`,
    ),
    chain: base,
  });

  // withdraw
  const withdrawAbi = parseAbi([
    "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares)",
  ]);
  const { request: withdrawReq } = await publicClient.simulateContract({
    abi: withdrawAbi,
    address: MORPHO_VAULT_ADDRESS as `0x${string}`,
    functionName: "withdraw",
    args: [
      parseUnits("0.1", 6),
      (turnkeyAccount as Account).address,
      (turnkeyAccount as Account).address,
    ],
    account: turnkeyAccount as Account,
  });
  const withdrawHash = await client.writeContract(withdrawReq);

  console.log(
    "Withdraw transaction:",
    `https://basescan.org/tx/${withdrawHash}`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
