# Kitchen Sink

A playground and example bank for making Turnkey requests in various ways:

- `src/http`: create Turnkey requests in the most primitive way, using `@turnkey/http` and a stamper (e.g. `@turnkey/api-key-stamper`)
  - [advanced] a sub-folder named `with-poller` is included to demonstrate how to make requests with an activity poller. Requests will almost always complete synchronously, but if you plan on making many concurrent requests and have no tolerance for unfinished requests, then we recommend using the poller, which will wait until the activity completes.
- `src/sdk-server`: create Turnkey requests using `@turnkey/sdk-server`, which abstracts away some of the internals in the above method. This is the preferred way to use Turnkey.
- 🚧 WIP `src/sdk-browser`: create Turnkey requests using `@turnkey/sdk-browser`, which also abstracts away some of the internals from the `@turnkey/http` approach. Note that `@turnkey/sdk-browser` has an interface identical to `@turnkey/sdk-server`

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/kitchen-sink/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

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

## Usage

In order to run any of these scripts, from `sdk/examples/kitchen-sink`, you can run `pnpm tsx src/sdk-server/createEthereumWallet.ts` (where `sdk-server` can be replaced by `http`, and `createEthereumWallet.ts` can be replaced by any other script)
