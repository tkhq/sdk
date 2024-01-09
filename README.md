# Turnkey SDK

[![js-build](https://github.com/tkhq/sdk/actions/workflows/js-build.yml/badge.svg)](https://github.com/tkhq/sdk/actions/workflows/js-build.yml)

API Docs: https://docs.turnkey.com/

## Packages

| Package                                                   | NPM                                                                                                                                       | Description                                                             | Changelog                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| [`@turnkey/ethers`](/packages/ethers)                     | [![npm](https://img.shields.io/npm/v/@turnkey/ethers?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/ethers)                     | Turnkey Signer for Ethers                                               | [CHANGELOG](/packages/ethers/CHANGELOG.md)           |
| [`@turnkey/viem`](/packages/viem)                         | [![npm](https://img.shields.io/npm/v/@turnkey/viem?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/viem)                         | (Experimental) Turnkey Helpers to work with Viem                        | [CHANGELOG](/packages/viem/CHANGELOG.md)             |
| [`@turnkey/cosmjs`](/packages/cosmjs)                     | [![npm](https://img.shields.io/npm/v/@turnkey/cosmjs?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/cosmjs)                     | (Experimental) Turnkey Cosmos Signer for CosmJS                         | [CHANGELOG](/packages/cosmjs/CHANGELOG.md)           |
| [`@turnkey/solana`](/packages/solana)                     | [![npm](https://img.shields.io/npm/v/@turnkey/solana?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/solana)                     | (Experimental) Turnkey Signer for Solana                                | [CHANGELOG](/packages/solana/CHANGELOG.md)           |
| [`@turnkey/http`](/packages/http)                         | [![npm](https://img.shields.io/npm/v/@turnkey/http?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/http)                         | Lower-level, fully typed HTTP client for interacting with Turnkey API   | [CHANGELOG](/packages/http/CHANGELOG.md)             |
| [`@turnkey/api-key-stamper`](/packages/api-key-stamper)   | [![npm](https://img.shields.io/npm/v/@turnkey/api-key-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/api-key-stamper)   | Provide API key signatures over Turnkey requests                        | [CHANGELOG](/packages/api-key-stamper/CHANGELOG.md)  |
| [`@turnkey/iframe-stamper`](/packages/iframe-stamper)     | [![npm](https://img.shields.io/npm/v/@turnkey/iframe-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/iframe-stamper)     | Provide API key signatures over Turnkey requests within iframe contexts | [CHANGELOG](/packages/iframe-stamper/CHANGELOG.md)   |
| [`@turnkey/webauthn-stamper`](/packages/webauthn-stamper) | [![npm](https://img.shields.io/npm/v/@turnkey/webauthn-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/webauthn-stamper) | Provide Webauthn signatures over Turnkey requests                       | [CHANGELOG](/packages/webauthn-stamper/CHANGELOG.md) |

## Code Examples

| Example                                                                | Description                                                                                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [`demo-consumer-wallet`](https://github.com/tkhq/demo-consumer-wallet) | A minimal consumer wallet app powered by Turnkey and WalletConnect                                                          |
| [`demo-passkey-wallet`](https://github.com/tkhq/demo-passkey-wallet)   | A minimal consumer wallet app powered by Turnkey and passkeys                                                               |
| [`demo-ethers-passkeys`](https://github.com/tkhq/demo-ethers-passkeys) | A NextJS app that demonstrates how to use `@turnkey/ethers` to build a passkey-powered application                          |
| [`demo-viem-passkeys`](https://github.com/tkhq/demo-viem-passkeys)     | A NextJS app that demonstrates how to use `@turnkey/viem` to build a passkey-powered application                            |
| [`deployer`](/examples/deployer/)                                      | Compile and deploy a smart contract                                                                                         |
| [`email-auth`](/examples/email-auth/)                                  | A NextJS app demonstrating a complete email auth flow                                                                       |
| [`email-recovery`](/examples/email-recovery/)                          | A NextJS app demonstrating a complete email recovery flow                                                                   |
| [`wallet-export`](/examples/wallet-export/)                            | A NextJS app demonstrating a complete wallet export flow                                                                    |
| [`rebalancer`](/examples/rebalancer/)                                  | A demo application which showcases an example of how to use Turnkey for managing multiple types of keys & users             |
| [`sweeper`](/examples/sweeper/)                                        | Sweep funds from one address to a different address                                                                         |
| [`trading-runner`](/examples/trading-runner/)                          | A sample application demonstrating a trading operation, using various private keys, users, and policies, powered by Uniswap |
| [`with-ethers`](/examples/with-ethers/)                                | Create a new Ethereum address, then sign and broadcast a transaction using the Ethers signer with Infura                    |
| [`with-viem`](/examples/with-viem/)                                    | Sign and broadcast a transaction using the Turnkey Custom Account and Infura                                                |
| [`with-cosmjs`](/examples/with-cosmjs/)                                | Create a new Cosmos address, then sign and broadcast a transaction on Celestia testnet using the CosmJS signer              |
| [`with-solana`](/examples/with-solana/)                                | Create a new Solana address, then sign and broadcast a transaction on Solana's devnet                                       |
| [`with-gnosis`](/examples/with-gnosis/)                                | Create new Ethereum addresses, configure a 3/3 Gnosis safe, and create + execute a transaction from it                      |
| [`with-uniswap`](/examples/with-uniswap/)                              | Sign and broadcast a Uniswap v3 trade using the Ethers signer with Infura                                                   |
| [`with-nonce-manager`](/examples/with-nonce-manager/)                  | Create a new Ethereum address, then sign and broadcast multiple transactions in a sequential or optimistic manner           |
| [`with-offline`](/examples/with-offline/)                              | Sign a Turnkey request in offline context                                                                                   |
| [`with-federated-passkeys`](/examples/with-federated-passkeys/)        | A NextJS app that demonstrates how to use Turnkey to build a federated, webauthn powered authentication flow                |

## Demos built with Turnkey

### Demo Consumer Wallet ([code](https://github.com/tkhq/demo-consumer-wallet))

A minimal consumer wallet app powered by Turnkey. Behind the scenes, it uses [`@turnkey/ethers`](https://www.npmjs.com/package/@turnkey/ethers) for signing and WalletConnect (v1) for accessing dapps.

https://github.com/tkhq/demo-consumer-wallet/assets/127255904/2c3409df-2d7c-4ec3-9aa8-e2944a0b0e0a

See https://github.com/tkhq/demo-consumer-wallet for the code.

### Demo Passkey Wallet ([code](https://github.com/tkhq/demo-passkey-wallet), [live link](https://wallet.tx.xyz))

A wallet application showing how users can register and authenticate using passkeys.
This demo uses the Turnkey API to create a new [Turnkey Sub-Organization](https://docs.turnkey.com/getting-started/sub-organizations) for each user, create a testnet Ethereum address and send a transaction on Sepolia (ETH testnet).

<img src="./img/demo-passkey-wallet.png" alt="homepage screenshot" width="800px">

See https://wallet.tx.xyz (and https://github.com/tkhq/demo-passkey-wallet for the code).

### Demo Ethers Passkeys ([code](https://github.com/tkhq/demo-ethers-passkeys))

A simple application demonstrating how to create sub-organizations, create private keys, and sign with the [`@turnkey/ethers`](https://github.com/tkhq/sdk/tree/main/packages/ethers) signer, using passkeys.

<img src="./img/ethers-ui-screenshot.png" alt="homepage screenshot" width="800px">

See https://github.com/tkhq/demo-ethers-passkeys for the code.

### Demo Viem Passkeys ([code](https://github.com/tkhq/demo-viem-passkeys))

A similar, simple application demonstrating how to create sub-organizations, create private keys, and sign with the [`@turnkey/viem`](https://github.com/tkhq/sdk/tree/main/packages/viem) signer, using passkeys.

<img src="./img/viem-ui-screenshot.png" alt="homepage screenshot" width="800px">

See https://github.com/tkhq/demo-viem-passkeys for the code.
