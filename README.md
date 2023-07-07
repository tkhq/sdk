# Turnkey SDK

[![js-build](https://github.com/tkhq/sdk/actions/workflows/js-build.yml/badge.svg)](https://github.com/tkhq/sdk/actions/workflows/js-build.yml)

API Docs: https://turnkey.readme.io/

## Packages

| Package                               | NPM                                                                                                                   | Description                                                           | Changelog                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| [`@turnkey/ethers`](/packages/ethers) | [![npm](https://img.shields.io/npm/v/@turnkey/ethers?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/ethers) | Turnkey Signer for Ethers                                             | [CHANGELOG](/packages/ethers/CHANGELOG.md) |
| [`@turnkey/cosmjs`](/packages/cosmjs) | [![npm](https://img.shields.io/npm/v/@turnkey/cosmjs?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/cosmjs) | (Experimental) Turnkey Cosmos Signer for CosmJS                       | [CHANGELOG](/packages/cosmjs/CHANGELOG.md) |
| [`@turnkey/http`](/packages/http)     | [![npm](https://img.shields.io/npm/v/@turnkey/http?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/http)     | Lower-level, fully typed HTTP client for interacting with Turnkey API | [CHANGELOG](/packages/http/CHANGELOG.md)   |

## Examples

| Example                                                                | Description                                                                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [`with-ethers`](/examples/with-ethers/)                                | Create a new Ethereum address, then sign and broadcast a transaction using the Ethers signer with Infura           |
| [`with-cosmjs`](/examples/with-cosmjs/)                                | Create a new Cosmos address, then sign and broadcast a transaction on Celestia testnet using the CosmJS signer     |
| [`with-solana`](/examples/with-solana/)                                | Create a new Solana address, then sign and broadcast a transaction on Solana's devnet                              |
| [`with-gnosis`](/examples/with-gnosis/)                                | Create new Ethereum addresses, configure a 3/3 Gnosis safe, and create + execute a transaction from it             |
| [`with-uniswap`](/examples/with-uniswap/)                              | Sign and broadcast a Uniswap v3 trade using the Ethers signer with Infura                                          |
| [`with-nonce-manager`](/examples/with-nonce-manager/)                  | Create a new Ethereum address, then sign and broadcast multiple transactions in a sequential or optimistic manner. |
| [`sweeper`](/examples/sweeper/)                                        | Sweep funds from one address to a different address                                                                |
| [`deployer`](/examples/deployer/)                                      | Compile and deploy a smart contract                                                                                |
| [`with-offline`](/examples/with-offline/)                              | Sign a Turnkey request in offline context                                                                          |
| [`demo-consumer-wallet`](https://github.com/tkhq/demo-consumer-wallet) | A minimal consumer wallet app powered by Turnkey and WalletConnect                                                 |
| [`with-federated-passkeys`](/examples/with-federated-passkeys/)        | A nextjs app that demonstrates how to use Turnkey to build a federated, webauthn powered authentication flow       |
