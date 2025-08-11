import * as path from 'path';
import * as dotenv from 'dotenv';
import { base } from 'viem/chains';
import { createAccount } from '@turnkey/viem';
import { Turnkey as TurnkeyServerSDK } from '@turnkey/sdk-server';
import {
  createWalletClient,
  http,
  type Account,
  createPublicClient,
  parseAbi,
} from 'viem';

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MORPHO_VAULT_ADDRESS = '0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183';

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
      `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY!}`
    ),
  });

  const publicClient = createPublicClient({
    transport: http(
      `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY!}`
    ),
    chain: base,
  });


  // Fetch balance
  const balanceAbi = parseAbi([
    'function balanceOf(address account) external view returns (uint256)',
  ]);

  const rawBalance = await publicClient.readContract({
    address: MORPHO_VAULT_ADDRESS as `0x${string}`,
    abi: balanceAbi,
    functionName: 'balanceOf',
    args: [turnkeyAccount.address],
  });

  // redeem all shares
  const redeemAbi = parseAbi([
    'function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets)',
  ]);
  const { request: redeemReq } = await publicClient.simulateContract({
    abi: redeemAbi,
    address: MORPHO_VAULT_ADDRESS as `0x${string}`,
    functionName: 'redeem',
    args: [
      rawBalance,
      (turnkeyAccount as Account).address,
      (turnkeyAccount as Account).address,
    ],
    account: turnkeyAccount as Account,
  });
  const redeemHash = await client.writeContract(redeemReq);

  console.log('redeem tx:', `https://basescan.org/tx/${redeemHash}`);

}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
