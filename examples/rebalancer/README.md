# Example: `rebalancer`

A demo application utiltiing the Turnkey API to setup an organization with users, private keys, and policies and interact with the resources.

## Usage

```
// setup an organization with users, private keys, and policies
pnpm cli setup

// distribute ETH from "Bank" private key to "Source" private keys
pnpm cli fund

// move ETH from "Source" private keys to "Sink" private key
pnpm cli sweep

// move ETH from "Sink" private key to "Bank" private key
pnpm cli recycle
```

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v16+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/sweeper/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://turnkey.readme.io/docs/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `INFURA_KEY` -- if this is not set, it will default to using the Community Infura key

## TODO

A demo application utilizing the Turnkey API to setup an organization with users, private keys, and policies

### Setup

- [x] - Create a user with an API key called "executor"
- [x] - Create a user with an API key called "manager"
- [x] - Create a user with an API key called "admin"
- [x] - Create a private key and label it "bank"
- [x] - Create 5 private keys and label them "source"
- [x] - Create a private key and label it "sink"
- [x] - Create a policy that "executor" can spend funds from a private key labeled "source"
- [x] - Create a policy that "manager" + "admin" can spend funds from a private key labeled "sink"

### Fund

- [x] - Loop over a set of addresses labeled "source"
- [x] - Send this address a constant value of ETH from "bank"

### Sweep

- [x] - Loop over a "source" addresses
- [x] - When an address has a balance that exceeds a constant value, sweep all funds (allowing for some dust) to "sink"

### Recycle

- [ ] - Initiate a transfer of funds from "sink" to "bank" unless there's an existing pending transfer
- [ ] - Approve that transfer in the UI using the authenticator for an "admin" user

### Thoughts

i'd like to demonstrate how turnkey could be set up to sweep funds from a set of addresses (calling these "source") to a more secure address (calling this "sink"). so first pass at a demo i was hoping to create a structure where:
execute a command "initialize" to create a a set of addresses, api keys, and policies in a new Turnkey account (this is outlined in a bit more detail in the README)
execute a command "fund" to send funds to the "source" addresses from an address called "bank"
execute a command "sweep" to send any funds that exceed some threshold from the "source" to the "sinks" using a single API key
execute a command "recycle" to, using a multi-party approval, sweep everything from "sink" back to "bank"
