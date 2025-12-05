import * as path from 'path';
import * as dotenv from 'dotenv';
import prompts from 'prompts';

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { tempo } from 'tempo.ts/chains';
import { tempoActions, Actions, withFeePayer } from 'tempo.ts/viem';
import {
  Account,
  createClient,
  http,
  publicActions,
  walletActions,
  parseUnits,
  formatUnits,
  serializeTransaction,
} from 'viem';
import { createAccount } from '@turnkey/viem';
import { Turnkey as TurnkeyServerSDK } from '@turnkey/sdk-server';
import { createNewWallet } from './createNewWallet';
import { print } from './util';

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewWallet();
    return;
  }

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
    // The following config is useful in contexts where an activity requires consensus.
    // By default, if the activity is not initially successful, it will poll a maximum
    // of 3 times with an interval of 1000 milliseconds. Otherwise, use the values below.
    //
    // -----
    //
    // activityPoller: {
    //   intervalMs: 5_000,
    //   numRetries: 10,
    // },
  });

  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const credentials = `${process.env['TEMPO_USERNAME']}:${process.env['TEMPO_PASSWORD']}`;
  // AlphaUSD TIP-20 token address
  const tip20TokenAddress =
    '0x20c0000000000000000000000000000000000001' as `0x${string}`;
  const client = createClient({
    account: turnkeyAccount as Account,
    chain: tempo({ feeToken: tip20TokenAddress }),
    transport: withFeePayer(
      http(undefined, {
        fetchOptions: {
          headers: {
            Authorization: `Basic ${btoa(credentials)}`,
          },
        },
      }),
      http('https://sponsor.testnet.tempo.xyz'),
    ),
  })
    .extend(publicActions)
    .extend(walletActions)
    .extend(tempoActions());

  const chainId = client.chain.id;
  const address = client.account.address;
  const transactionCount = await client.getTransactionCount({ address });

  // Check TIP-20 token balance using tempo.ts token actions
  let balance = await Actions.token.getBalance(client, {
    token: tip20TokenAddress,
    account: address,
  });

  const metadata = await Actions.token.getMetadata(client, {
    token: tip20TokenAddress,
  });

  print('Network:', `${client.chain.name} (chain ID ${chainId})`);
  print('Address:', address);
  print(
    `${metadata.name} Balance:`,
    `${formatUnits(balance, metadata.decimals)}`,
  );
  print('Transaction count:', `${transactionCount}`);

  // create a simple send transaction
  const { amount, destination } = await prompts([
    {
      type: 'text',
      name: 'amount',
      message: 'Amount to send  (default is 1 )',
      initial: '1',
    },
    {
      type: 'text',
      name: 'destination',
      message: 'Destination address (default is yourself)',
      initial: address,
    },
  ]);

  if (balance === 0n) {
    print(
      `Your ${metadata.name} balance is 0! Funding your account...`,
      'See https://docs.tempo.xyz/guide/quickstart/faucet',
    );

    const receipts = await Actions.faucet.fundSync(client, {
      account: address,
    });

    balance = await Actions.token.getBalance(client, {
      token: tip20TokenAddress,
      account: address,
    });
    print(
      `${metadata.name} Balance:`,
      `${formatUnits(balance, metadata.decimals)}`,
    );
    print(
      'Receipts:',
      `${receipts
        .map(
          (receipt) =>
            `https://explore.tempo.xyz/tx/${receipt.transactionHash}`,
        )
        .join('\n')}`,
    );
  }

  // Convert amount string to token units (6 decimals for Tempo stablecoins)
  const amountInUnits = parseUnits(amount, 6);

  // Get the transfer call data using tempo.ts token actions
  const transferCall = Actions.token.transfer.call({
    token: tip20TokenAddress,
    to: destination as `0x${string}`,
    amount: amountInUnits,
  });

  // Prepare the transaction request
  const request = await client.prepareTransactionRequest({
    ...transferCall,
    value: 0n, // Tempo requires value to be 0
    account: turnkeyAccount as Account,
  });

  // Extract only the serializable transaction fields (remove Tempo-specific fields)
  const { account, feeToken, ...serializableRequest } = request as any;

  // Get the serialized unsigned transaction
  const serializedUnsignedTx = serializeTransaction(serializableRequest);

  // Sign the transaction with Turnkey
  const { r, s, v } = await turnkeyClient.apiClient().signRawPayload({
    signWith: process.env.SIGN_WITH!,
    payload: serializedUnsignedTx,
    encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
    hashFunction: 'HASH_FUNCTION_KECCAK256',
  });

  // Combine signature with transaction
  const serializedTx = serializeTransaction(serializableRequest, {
    r: r as `0x${string}`,
    s: s as `0x${string}`,
    v: BigInt(v),
  });

  // Send the raw signed transaction
  const txHash = await client.sendRawTransaction({
    serializedTransaction: serializedTx,
  });

  print(
    `Sent ${amount} TIP-20 tokens to ${destination}:`,
    `https://explore.tempo.xyz/tx/${txHash}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
