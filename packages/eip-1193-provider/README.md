# Turnkey EIP-1193 Provider

The `@turnkey/eip-1193-provider` package delivers a Turnkey-compatible Ethereum provider that adheres to the EIP-1193 standards. It's built to integrate seamlessly with a broad spectrum of EVM-compatible chains, offering capabilities like account management, transaction signing, and blockchain interaction. This initial setup is intended for use in conjunction with the [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http) and [`@turnkey/webauthn-stamper`](https://www.npmjs.com/package/@turnkey/webauthn-stamper) package, for initial authentication.

## Installation

Before you start using the Turnkey EIP-1193 Provider, make sure to install the necessary packages in your project. This guide assumes you have a Node.js environment ready for development.

Install the required packages using NPM or Yarn:

```bash
npm install @turnkey/eip-1193-provider @turnkey/http @turnkey/webauthn-stamper
```

```bash
pnpm add @turnkey/eip-1193-provider @turnkey/http @turnkey/webauthn-stamper
```

```bash
yarn add @turnkey/eip-1193-provider @turnkey/http @turnkey/webauthn-stamper
```

## Initialization

To set up the Turnkey EIP-1193 Provider, you need to initialize it with your configuration, which includes setting up the Turnkey client with your base URL and stamper.

```ts
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { TurnkeyClient } from "@turnkey/http";

const stamper = new WebauthnStamper({
  rpId: "example.com",
});

// Initialize the Turnkey HTTP client
const turnkeyClient = new TurnkeyClient(
  { baseUrl: "https://api.turnkey.com" },
  stamper,
);

// Get the organizationId of the sub-organization connected to the users account
const { organizationId } = await turnkeyClient.getWhoami({
  organizationId: process.env.ORGANIZATION_ID,
});

// Get the user wallets associated with their sub-organization
const { wallets } = await turnkeyClient.getWallets({
  organizationId,
});

// Get the walletId to connect to the provider
const walletId = wallets[0].walletId;

const chain = {
  chainName: "Ethereum Mainnet",
  chainId: "0x1",
  rpcUrls: ["https://mainnet.infura.io/v3/your-infura-project-id"],
};

// Initialize the EIP-1193 Provider with your configuration
const provider = await createEIP1193Provider({
  walletId,
  organizationId,
  turnkeyClient,
  chains: [
    chain,
    // Add more chains as needed
  ],
});
```

## Usage

### `eth_requestAccounts`

Requests the user to provide an Ethereum address for identification, as specified by [EIP-1102](https://eips.ethereum.org/EIPS/eip-1102). This method initiates connectivity with the client and will prompt for passkey authentication.

```javascript
const accounts = await provider.request({ method: "eth_requestAccounts" });
// Logs the array accounts associated with the provided walletId & organization
console.log(accounts);
```

### Authentication Prompt Methods

The following methods also prompt for passkey authentication:

- `personal_sign`: Signs a message with the specified account.
- `eth_sign`: Signs data with the specified account.
- `eth_signTransaction`: Signs a transaction with the specified account.
- `eth_signTypedData_v4`: Signs typed data according to EIP-712 with the specified account.
- `eth_sendTransaction`: Submits a transaction to the network for execution.

## Testing (Local)

1. Copy `.env.example` to `.env`

   ```bash
   $ cp .env.example .env
   ```

2. Start the Anvil node in one shell:

   - Install [Foundry](https://book.getfoundry.sh/getting-started/installation) & Anvil if you haven't done so already
   - Add Foundry to your `$PATH`
     ```bash
     $ export PATH="$PATH:$HOME/.foundry/bin"
     ```
   - Source your env e.g.
     ```bash
     $ source ~/.zshrc
     ```
   - Run `foundryup` to install `Anvil`
     ```bash
     $ foundryup
     ```
   - Start Anvil
     ```
     $ pnpm anvil
     ```

3. Run the tests in a new shell:

   ```
   $ pnpm test
   ```

## Contributing

We welcome contributions to improve the `Turnkey EIP-1193 Provider`. Please follow the project's [contribution guidelines](https://github.com/tkhq/sdk/blob/ad9071716919d062ba67fd623a01cbd4523ed444/CONTRIBUTING.md).

## License

This project is licensed under [LICENSE](./LICENSE), with detailed information available in the repository.
