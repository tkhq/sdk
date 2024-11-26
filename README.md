# Turnkey SDK

[![js-build](https://github.com/tkhq/sdk/actions/workflows/js-build.yml/badge.svg)](https://github.com/tkhq/sdk/actions/workflows/js-build.yml)

## Primary Turnkey SDK Web Packages
SDK Web Packages
The following packages expose the functionality required to build Turnkey-Powered applications. 
- [`@turnkey/sdk-browser`](https://github.com/tkhq/sdk/tree/main/packages/sdk-browser) 
- [`@turnkey/sdk-server`](https://github.com/tkhq/sdk/tree/main/packages/sdk-server)
- [`@turnkey/sdk-react`](https://github.com/tkhq/sdk/tree/main/packages/sdk-react)
- [`@turnkey/sdk-react-native-stamper`](https://www.npmjs.com/package/@turnkey/sdk-react-native-stamper)

The below diagram can help provide an understanding of which package can be used where while developing your Turnkey Powered Application. 

## [DIAGRAM HERE]

### [`@turnkey/sdk-browser`](https://github.com/tkhq/sdk/tree/main/packages/sdk-browser)  
The [`@turnkey/sdk-browser`](https://github.com/tkhq/sdk/tree/main/packages/sdk-browser) package exposes functionality that lets developers build browser based applications that interact with the Turnkey API with different types of authentication. 

It consists of different clients that enable requests to the API to be authenticated via different auth methods like user sessions, passkeys and iFrames. It also contains methods to manage information and state related to authentication like auth bundles and sessions, retrieving user information and server signing API requests.

[![npm](https://img.shields.io/npm/v/@turnkey/http?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-browser)

[CHANGELOG](/packages/sdk-browser/CHANGELOG.md)  

Docs Page: https://docs.turnkey.com/sdks/javascript-browser

### [`@turnkey/sdk-server`](https://github.com/tkhq/sdk/tree/main/packages/sdk-server)
The [`@turnkey/sdk-server`](https://github.com/tkhq/sdk/tree/main/packages/sdk-server) package exposes functionality that lets developers build server-side functionality for applications that interact with the Turnkey API with different types of authentication –  allowing applications to authenticate users, manage sessions, and perform organizational operations securely and efficiently. It consists of an API Client and API Proxies that enable requests to the Turnkey API to be authenticated with the appropriate credentials. Specifically, the API Client manages requests signed by the user’s authentication details, and the API proxies handle requests signed by the parent organization’s authentication details. 

Use the [`@turnkey/sdk-server`](https://www.npmjs.com/package/@turnkey/sdk-server) package to handle server-side interactions for applications that interact with the Turnkey API.

[![npm](https://img.shields.io/npm/v/@turnkey/sdk-server?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-server)  

[CHANGELOG](/packages/sdk-server/CHANGELOG.md)

Docs Page: https://docs.turnkey.com/sdks/javascript-server

### [`@turnkey/sdk-react`](https://github.com/tkhq/sdk/tree/main/packages/sdk-react)
The [`@turnkey/sdk-react`](https://github.com/tkhq/sdk/tree/main/packages/sdk-react) package wraps the functionality from the [`@turnkey/sdk-browser`](https://github.com/tkhq/sdk/tree/main/packages/sdk-browser) package to allow developers to build react based applications that interact with the Turnkey API with different types of authentication. It allows developers to use the same clients exposed in [`@turnkey/sdk-browser`](https://github.com/tkhq/sdk/tree/main/packages/sdk-browser) that enable requests to the API to be authenticated via different auth methods like user sessions, passkey and iFrames. It also contains the same methods to manage information and state related to authentication like auth bundles and sessions, retrieving user information and server signing API requests. Use the [`@turnkey/sdk-react`](https://github.com/tkhq/sdk/tree/main/packages/sdk-browser) package when you’re building React-based frontend applications that interact with the Turnkey API.

[![npm](https://img.shields.io/npm/v/@turnkey/sdk-react?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-react)

[CHANGELOG](/packages/sdk-react/CHANGELOG.md)

Docs Page: https://docs.turnkey.com/sdks/react

### [`@turnkey/sdk-react-native-stamper`](https://www.npmjs.com/package/@turnkey/sdk-react-native-stamper)
Turnkey provides a React Native stamper library, meant to be used in conjunction with the Turnkey http client, to facilitate using passkeys to interact with Turnkey's API within React Native applications. See https://github.com/tkhq/sdk/tree/main/packages/react-native-passkey-stamper for more details.

[![npm](https://img.shields.io/npm/v/@turnkey/react-native-passkey-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/react-native-passkey-stamper)

[CHANGELOG](/packages/react-native-passkey-stamper/CHANGELOG.md)

Docs Page: https://docs.turnkey.com/sdks/react-native




API Docs: https://docs.turnkey.com/

## Packages

| Package                                                                           | NPM                                                                                                                                                               | Description                                                             | Changelog                                                        | Category           |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------ |
| [`@turnkey/ethers`](/packages/ethers)                                             | [![npm](https://img.shields.io/npm/v/@turnkey/ethers?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/ethers)                                             | Turnkey Signer for Ethers                                               | [CHANGELOG](/packages/ethers/CHANGELOG.md)                       | Signing            |
| [`@turnkey/viem`](/packages/viem)                                                 | [![npm](https://img.shields.io/npm/v/@turnkey/viem?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/viem)                                                 | Turnkey Signer for Viem                                                 | [CHANGELOG](/packages/viem/CHANGELOG.md)                         | Signing            |
| [`@turnkey/cosmjs`](/packages/cosmjs)                                             | [![npm](https://img.shields.io/npm/v/@turnkey/cosmjs?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/cosmjs)                                             | Turnkey Signer for CosmJS                                               | [CHANGELOG](/packages/cosmjs/CHANGELOG.md)                       | Signing            |
| [`@turnkey/solana`](/packages/solana)                                             | [![npm](https://img.shields.io/npm/v/@turnkey/solana?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/solana)                                             | Turnkey Signer for Solana                                               | [CHANGELOG](/packages/solana/CHANGELOG.md)                       | Signing            |
| [`@turnkey/eip-1193-provider`](/packages/eip-1193-provider)                       | [![npm](https://img.shields.io/npm/v/@turnkey/eip-1193-provider?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/eip-1193-provider)                       | Turnkey-compatible EIP-1193 Provider                                    | [CHANGELOG](/packages/eip-1193-provider/CHANGELOG.md)            | Signing            |
| [`@turnkey/encoding`](/packages/encoding)                                         | [![npm](https://img.shields.io/npm/v/@turnkey/encoding?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/encoding)                                         | Encoding and decoding utilities, primarily for internal usage           | [CHANGELOG](/packages/encoding/CHANGELOG.md)                     | Utilities          |
| [`@turnkey/crypto`](/packages/crypto)                                             | [![npm](https://img.shields.io/npm/v/@turnkey/crypto?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/crypto)                                             | Cryptographic utilities for P256 keys, encryption, and decryption       | [CHANGELOG](/packages/crypto/CHANGELOG.md)                       | Utilities          |
| [`@turnkey/sdk-browser`](/packages/sdk-browser)                                   | [![npm](https://img.shields.io/npm/v/@turnkey/sdk-browser?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-browser)                                   | Abstractions for using Turnkey in a browser environment                 | [CHANGELOG](/packages/sdk-browser/CHANGELOG.md)                  | Client abstraction |
| [`@turnkey/sdk-server`](/packages/sdk-server)                                     | [![npm](https://img.shields.io/npm/v/@turnkey/sdk-server?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-server)                                     | Abstractions for using Turnkey in a server environment                  | [CHANGELOG](/packages/sdk-server/CHANGELOG.md)                   | Client abstraction |
| [`@turnkey/sdk-react`](/packages/sdk-react)                                       | [![npm](https://img.shields.io/npm/v/@turnkey/sdk-react?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-react)                                       | Abstractions for using Turnkey with React                               | [CHANGELOG](/packages/sdk-react/CHANGELOG.md)                    | Client abstraction |
| [`@turnkey/react-native-passkey-stamper`](/packages/react-native-passkey-stamper) | [![npm](https://img.shields.io/npm/v/@turnkey/react-native-passkey-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/react-native-passkey-stamper) | Passkey signing support in the React Native environment                 | [CHANGELOG](/packages/react-native-passkey-stamper/CHANGELOG.md) | Client abstraction |
| [`@turnkey/http`](/packages/http)                                                 | [![npm](https://img.shields.io/npm/v/@turnkey/http?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/http)                                                 | Lower-level, fully typed HTTP client for interacting with Turnkey API   | [CHANGELOG](/packages/http/CHANGELOG.md)                         | Turnkey primitives |
| [`@turnkey/api-key-stamper`](/packages/api-key-stamper)                           | [![npm](https://img.shields.io/npm/v/@turnkey/api-key-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/api-key-stamper)                           | Provide API key signatures over Turnkey requests                        | [CHANGELOG](/packages/api-key-stamper/CHANGELOG.md)              | Turnkey primitives |
| [`@turnkey/iframe-stamper`](/packages/iframe-stamper)                             | [![npm](https://img.shields.io/npm/v/@turnkey/iframe-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/iframe-stamper)                             | Provide API key signatures over Turnkey requests within iframe contexts | [CHANGELOG](/packages/iframe-stamper/CHANGELOG.md)               | Turnkey primitives |
| [`@turnkey/webauthn-stamper`](/packages/webauthn-stamper)                         | [![npm](https://img.shields.io/npm/v/@turnkey/webauthn-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/webauthn-stamper)                         | Provide Webauthn signatures over Turnkey requests                       | [CHANGELOG](/packages/webauthn-stamper/CHANGELOG.md)             | Turnkey primitives |
| [`@turnkey/wallet-stamper`](/packages/wallet-stamper)                             | [![npm](https://img.shields.io/npm/v/@turnkey/wallet-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/wallet-stamper)                             | Provide wallet signatures over Turnkey requests                         | [CHANGELOG](/packages/wallet-stamper/CHANGELOG.md)               | Turnkey primitives |

## Code Examples

| Example                                                                | Description                                                                                                                             |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`demo-consumer-wallet`](https://github.com/tkhq/demo-consumer-wallet) | A minimal consumer wallet app powered by Turnkey and WalletConnect                                                                      |
| [`demo-passkey-wallet`](https://github.com/tkhq/demo-passkey-wallet)   | A minimal consumer wallet app powered by Turnkey and passkeys                                                                           |
| [`demo-ethers-passkeys`](https://github.com/tkhq/demo-ethers-passkeys) | A NextJS app that demonstrates how to use `@turnkey/ethers` to build a passkey-powered application                                      |
| [`demo-viem-passkeys`](https://github.com/tkhq/demo-viem-passkeys)     | A NextJS app that demonstrates how to use `@turnkey/viem` to build a passkey-powered application                                        |
| [`passkeyapp`](https://github.com/tkhq/passkeyapp)                     | A React Native + Expo app powered by Turnkey and passkeys                                                                               |
| [`deployer`](/examples/deployer/)                                      | Compile and deploy a smart contract                                                                                                     |
| [`email-auth`](/examples/email-auth/)                                  | A NextJS app demonstrating a complete email auth flow using Turnkey iframes                                                             |
| [`email-auth-local-storage`](/examples/email-auth-local-storage/)      | A NextJS app demonstrating a complete email auth flow using a locally stored target embedded key                                        |
| [`email-recovery`](/examples/email-recovery/)                          | A NextJS app demonstrating a complete email recovery flow using Turnkey iframes                                                         |
| [`wallet-import-export`](/examples/wallet-import-export/)              | A NextJS app demonstrating complete wallet import and export flows                                                                      |
| [`rebalancer`](/examples/rebalancer/)                                  | A demo application which showcases an example of how to use Turnkey for managing multiple types of keys & users                         |
| [`sweeper`](/examples/sweeper/)                                        | Sweep funds from one address to a different address                                                                                     |
| [`trading-runner`](/examples/trading-runner/)                          | A sample application demonstrating a trading operation, using various private keys, users, and policies, powered by Uniswap             |
| [`with-ethers`](/examples/with-ethers/)                                | Create a new Ethereum address, then sign and broadcast a transaction using the Ethers signer with Infura                                |
| [`with-viem`](/examples/with-viem/)                                    | Sign and broadcast a transaction using the Turnkey Custom Account and Infura                                                            |
| [`with-cosmjs`](/examples/with-cosmjs/)                                | Create a new Cosmos address, then sign and broadcast a transaction on Celestia testnet using the CosmJS signer                          |
| [`with-solana`](/examples/with-solana/)                                | Create a new Solana address, then sign and broadcast a transaction on Solana's devnet                                                   |
| [`with-bitcoin`](/examples/with-bitcoin/)                              | Create a new wallet, derive a BTC address, create, sign, and broadcast a transaction using BitcoinJS and other external APIs            |
| [`with-gnosis`](/examples/with-gnosis/)                                | Create new Ethereum addresses, configure a 3/3 Gnosis safe, and create + execute a transaction from it                                  |
| [`with-uniswap`](/examples/with-uniswap/)                              | Sign and broadcast a Uniswap v3 trade using the Ethers signer with Infura                                                               |
| [`with-nonce-manager`](/examples/with-nonce-manager/)                  | Create a new Ethereum address, then sign and broadcast multiple transactions in a sequential or optimistic manner                       |
| [`with-offline`](/examples/with-offline/)                              | Sign a Turnkey request in offline context                                                                                               |
| [`with-federated-passkeys`](/examples/with-federated-passkeys/)        | A NextJS app that demonstrates how to use Turnkey to build a federated, webauthn powered authentication flow                            |
| [`with-solana-passkeys`](/examples/with-solana-passkeys/)              | A NextJS app powering users to create suborgs, sign messages, and create transactions sponsored by the parent org using @turnkey/solana |
| [`with-eth-passkey-signers`](/examples/with-eth-passkey-signers/)      | A NextJS app powering users to create suborgs and sign messages via Viem or Ethers                                                      |
| [`with-eip-1193-provider`](/examples/with-eip-1193-provider/)          | A NextJS app that demonstrates how to use Turnkey the `@turnkey/eip-1193-provider` in your app                                          |
| [`with-wallet-stamper`](/examples/with-wallet-stamper/)                | A NextJS app that demonstrates how to use Turnkey the `@turnkey/wallet-stamper` in your app                                             |

## Demos built with Turnkey

### Demo Consumer Wallet ([code](https://github.com/tkhq/demo-consumer-wallet))

A minimal consumer wallet app powered by Turnkey. Behind the scenes, it uses [`@turnkey/ethers`](https://www.npmjs.com/package/@turnkey/ethers) for signing and WalletConnect (v1) for accessing dapps.

https://github.com/tkhq/demo-consumer-wallet/assets/127255904/2c3409df-2d7c-4ec3-9aa8-e2944a0b0e0a

See https://github.com/tkhq/demo-consumer-wallet for the code.

### Demo Passkey Wallet ([code](https://github.com/tkhq/demo-passkey-wallet), [live link](https://wallet.tx.xyz))

A wallet application showing how users can register and authenticate using passkeys.
This demo uses the Turnkey API to create a new [Turnkey Sub-Organization](https://docs.turnkey.com/concepts/sub-organizations) for each user, create a testnet Ethereum address and send a transaction on Sepolia (ETH testnet).

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

### React Native Passkey App ([code](https://github.com/tkhq/passkeyapp))

A simple React Native app that demonstrates sign up and sign in with passkeys, as well as Email Auth support.

https://github.com/r-n-o/passkeyapp/assets/104520680/9fabf71c-d88a-4631-8bfa-14b55c72967b

See https://github.com/tkhq/passkeyapp for the code.
