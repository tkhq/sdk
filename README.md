# Turnkey SDK

[![js-build](https://github.com/tkhq/sdk/actions/workflows/js-build.yml/badge.svg)](https://github.com/tkhq/sdk/actions/workflows/js-build.yml)

API Docs: https://turnkey.readme.io/

## Packages

| Package                               | NPM                                                                                                                   | Description                                                           | Changelog                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| [`@turnkey/ethers`](/packages/ethers) | [![npm](https://img.shields.io/npm/v/@turnkey/ethers?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/ethers) | Turnkey Signer for Ethers                                             | [CHANGELOG](/packages/ethers/CHANGELOG.md) |
| [`@turnkey/http`](/packages/http)     | [![npm](https://img.shields.io/npm/v/@turnkey/http?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/http)     | Lower-level, fully typed HTTP client for interacting with Turnkey API | [CHANGELOG](/packages/http/CHANGELOG.md)   |

## Examples

| Example                                   | Description                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [`with-ethers`](/examples/with-ethers/)   | Create a new Ethereum address, then sign and broadcast a transaction using the Ethers signer with Infura |
| [`with-gnosis`](/examples/with-gnosis/)   | Create new Ethereum addresses, configure a 3/3 Gnosis safe, and create + execute a transaction from it   |
| [`with-uniswap`](/examples/with-uniswap/) | Sign and broadcast a Uniswap v3 trade using the Ethers signer with Infura                                |
| [`sweeper`](/examples/sweeper/)           | Sweep funds from one address to a different address                                                      |
| [`deployer`](/examples/deployer/)         | Compile and deploy a smart contract                                                                      |
