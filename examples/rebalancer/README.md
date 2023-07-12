# Example: `rebalancer`

A demo application utiltiing the Turnkey API to setup an organization with users, private keys, and policies and interact with the resources.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v16+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/rebalancer/
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

### 3/ Setup

Create the organizational structure required for this demo:

```
// setup an organization with users, private keys, and policies
pnpm cli setup
```

This will create:
- Create 3 user tags: Admin, Manager, and Executor
- Create 3 users: Alice, Bob, and Phil
- Assign the user tags to the users
- Create 3 private key tags: Bank, Sink, and Source
- Create 5 private keys: Bank, Sink, and Source 1-3
- Assign the private key tags to the private keys
- Create 3 policies to control which users have access to which private keys



// distribute ETH from "Bank" private key to "Source" private keys
// optional: `--interval` flag to repeatedly run at a specified interval (expressed in milliseconds)
pnpm cli fund [--interval=$INTERVAL_MS]

// move ETH from "Source" private keys to "Sink" private key
// optional: `--interval` flag to repeatedly run at a specified interval (expressed in milliseconds)
pnpm cli sweep [--interval=$INTERVAL_MS --key=phil]

// move ETH from "Sink" private key to "Bank" private key
// optional: `--interval` flag to repeatedly run at a specified interval (expressed in milliseconds)
pnpm cli recycle [--interval=$INTERVAL_MS --key=bob]

// poll for recycle activities, and broadcast the transaction if consensus has been met
// optional: `--interval` flag to repeatedly run at a specified interval (expressed in milliseconds)
pnpm cli pollAndBroadcast [--interval=$INTERVAL_MS]

// approve an activity
pnpm cli approveActivity [--id=$ACTIVITY_ID --key=alice]

// reject an activity
pnpm cli rejectActivity [--id=$ACTIVITY_ID --key=alice]
```
