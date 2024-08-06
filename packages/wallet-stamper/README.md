# Turnkey Wallet Stamper

The `@turnkey/wallet-stamper` package provides a mechanism to stamp requests using a wallet public key and signature. This package supports both Solana and Ethereum wallets, allowing for seamless integration with various blockchain applications.

## Installation

Before you start using the Turnkey Wallet Stamper, make sure to install the necessary packages in your project. This guide assumes you have a Node.js environment ready for development.

Install the required packages using NPM, Yarn, or PNPM:

```bash
npm install @turnkey/wallet-stamper @turnkey/http
```

## Usage

### Prerequisites

#### Add Wallet Public Key as Authenticator

To use the wallet stamper, you must add the user's wallet public key as an API key authenticator.
This can be achieved either by creating a sub-organization activity or by generating a new API key and passing in the wallet's public key.

The API key stamper is necessary because we need to use the parent organization's API key to add the authenticator initially.
Once this is done, the wallet can stamp activity requests independently without needing the parent organization's API private and public keys.

Below are the steps to add a Solana public key as a wallet authenticator:

```typescript
const apiKeyStamper = new ApiKeyStamper({
  apiPublicKey: process.env.API_PUBLIC_KEY ?? '',
  apiPrivateKey: process.env.API_PRIVATE_KEY ?? '',
});

const client = new TurnkeyClient({ baseUrl: BASE_URL }, apiKeyStamper);

const activityPoller = createActivityPoller({
  client,
  requestFn: client.createApiKeys,
});

// See "Example: Signing with a Solana Wallet" below for how to implement the SolanaWallet interface
const mockWallet = new MockSolanaWallet();

// This is the public key of the wallet that will be added as an API key and used to stamp future requests
const publicKey = mockWallet.recoverPublicKey();

// The userId of the user that we will add the wallet public key as an authenticator
const userId = 'f4a5e6b4-3b9c-4f69-b7f6-9c2f456a4d23';

// We set the curve type to 'API_KEY_CURVE_ED25519' for solana wallets
// If using an EVM wallet, set the curve type to 'API_KEY_CURVE_SECP256K1'
const curveType = 'API_KEY_CURVE_ED25519';

const result = activityPoller({
  type: 'ACTIVITY_TYPE_CREATE_API_KEYS_V2',
  timestampMs: new Date().getTime().toString(),
  organizationId: 'acd0bc97-2af5-475b-bc34-0fa7ca3bdc75',
  parameters: {
    apiKeys: [
      {
        apiKeyName: 'test-wallet-stamper',
        publicKey,
        curveType: 'API_KEY_CURVE_ED25519',
      },
    ],
    userId,
  },
});
```

#### Using the Wallet Stamper

To use the `@turnkey/wallet-stamper` package, follow these steps:

1. **Choose Your Wallet Type**: Decide whether you will use an EVM-based wallet (e.g., Ethereum) or a Solana-based wallet.

2. **Implement the Wallet Interface**: Depending on your chosen blockchain, implement the wallet interface. This involves creating methods to sign messages and recover public keys.

3. **Instantiate the WalletStamper**: Create an instance of the `WalletStamper` using the wallet interface.

4. **Instantiate the TurnkeyClient**: Create an instance of the `TurnkeyClient` with the `WalletStamper` instance.

5. **Stamp Requests**: Now when making request using the TurnkeyClient, the wallet stamper will automatically stamp the request with the user's wallet public key and signature.

### Example: Signing with a Solana Wallet

In this example, we are using a local Solana wallet.
For information on using an injected Solana wallet such as Solflare, please refer to the [`with-wallet-stamper`](../../examples/with-wallet-stamper) example.

```typescript
import { Keypair } from '@solana/web3.js';
import { decodeUTF8 } from 'tweetnacl-util';
import nacl from 'tweetnacl';
import { TurnkeyClient } from '@turnkey/http';
import { WalletStamper, SolanaWalletInterface } from '@turnkey/wallet-stamper';

class SolanaWallet implements SolanaWalletInterface {
  keypair = Keypair.fromSecretKey(SOLANA_PRIVATE_KEY);
  type = 'solana' as const;

  async signMessage(message: string): Promise<string> {
    const messageBytes = decodeUTF8(message);
    const signature = nacl.sign.detached(messageBytes, this.keypair.secretKey);
    return Buffer.from(signature).toString('hex');
  }

  recoverPublicKey(): string {
    // Convert the base24 encoded Solana wallet public key (the one displayed in the wallet)
    // into the ed25519 decoded public key
    const ed25519PublicKey = Buffer.from(
      this.keypair.publicKey.toBuffer()
    ).toString('hex');
    return ed25519PublicKey;
  }
}

// Instantiate the WalletStamper with the SolanaWallet
const walletStamper = new WalletStamper(new SolanaWallet());

// Instantiate the TurnkeyClient with the WalletStamper
const client = new TurnkeyClient({ baseUrl: BASE_URL }, walletStamper);

// Get a user stamping the request with their wallet
const user = await client.getUser({
  organizationId: ORGANIZATION_ID,
  userId: USER_ID,
});
```

### Example: Signing with an Ethereum Wallet

The primary difference between signing with an Ethereum Wallet and a Solana Wallet is the process of obtaining the public key.
For Solana, the public key can be directly derived from the wallet. However, for Ethereum, the secp256k1 public key cannot be directly retrieved.
Instead, you must first obtain a signature from the user and then recover the public key from that signature.
This additional step is why the Ethereum Wallet (EVM Wallet) interface includes a different method for recovering the public key.

```typescript
import {
  createWalletClient,
  custom,
  recoverPublicKey,
  hashMessage,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

import { WalletStamper, EvmWalletInterface } from '@turnkey/wallet-stamper';
export class EthereumWallet implements EvmWalletInterface {
  account = privateKeyToAccount(ETHEREUM_PRIVATE_KEY);
  type = 'evm' as const;

  async signMessage(message: string): Promise<string> {
    // Create a new wallet client with a JSON-RPC account from the injected provider
    const walletClient = createWalletClient({
      chain: mainnet,
      transport: custom(window.ethereum!),
    });
    // Prompt the user to sign the message with their wallet
    const signature = await walletClient.signMessage({
      account: this.account,
      message,
    });
    return signature;
  }

  async recoverPublicKey(message: string, signature: string): Promise<string> {
    const secp256k1PublicKey = recoverPublicKey({
      hash: hashMessage(message),
      signature: signature as Hex,
    });
    return secp256k1PublicKey;
  }
}
```

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

## License

The `@turnkey/wallet-stamper` package is licensed under the [MIT License](LICENSE).
