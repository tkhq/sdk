import * as path from 'path';
import * as dotenv from 'dotenv';
import { base } from 'viem/chains';
import { createAccount } from '@turnkey/viem';
import { Turnkey as TurnkeyServerSDK } from '@turnkey/sdk-server';
import {
  http,
  createPublicClient,
  parseAbi,
  formatUnits,
} from 'viem';

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MORPHO_VAULT_ADDRESS = process.env.MORPHO_VAULT_ADDRESS!;
const BASE_CHAIN_ID = process.env.BASE_CHAIN_ID!;

async function main() {
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.TURNKEY_BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const publicClient = createPublicClient({
    transport: http(
      `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY!}`
    ),
    chain: base,
  });

  // Fetch decimals & balance
  const balanceAbi = parseAbi([
    'function balanceOf(address account) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
  ]);

  const decimals = await publicClient.readContract({
    address: MORPHO_VAULT_ADDRESS as `0x${string}`,
    abi: balanceAbi,
    functionName: 'decimals',
  });

  const rawBalance = await publicClient.readContract({
    address: MORPHO_VAULT_ADDRESS as `0x${string}`,
    abi: balanceAbi,
    functionName: 'balanceOf',
    args: [turnkeyAccount.address],
  });

  // Format to human-readable
  const readableBalance = formatUnits(rawBalance, decimals);
  console.log(`user vault balance: ${readableBalance} shares`);

  // fetch vault data
  const query = `
    query {
      vaultByAddress(
        address: "${MORPHO_VAULT_ADDRESS}"
        chainId: ${BASE_CHAIN_ID}
      ) {
        state {
          sharePriceUsd
          apy
        }
        asset {
          priceUsd
        }
      }
    }
  `;

  const response = await fetch('https://api.morpho.org/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const json = await response.json();

  console.log('vault data:', JSON.stringify(json.data, null, 2));
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
