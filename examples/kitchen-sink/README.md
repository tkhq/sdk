# Kitchen Sink

A playground and example bank for making Turnkey requests in various ways:

- `src/http`: create Turnkey requests in the most primitive way, using `@turnkey/http` and a stamper (e.g. `@turnkey/api-key-stamper`)
  - [advanced] a sub-folder named `with-poller` is included to demonstrate how to make requests with an activity poller. Requests will almost always complete synchronously, but if you plan on making many concurrent requests and have no tolerance for unfinished requests, then we recommend using the poller, which will wait until the activity completes.
- `src/sdk-server`: create Turnkey requests using `@turnkey/sdk-server`, which abstracts away some of the internals in the above method. This is the preferred way to use Turnkey.
- 🚧 WIP `src/sdk-browser`: create Turnkey requests using `@turnkey/sdk-browser`, which also abstracts away some of the internals from the `@turnkey/http` approach. Note that `@turnkey/sdk-browser` has an interface identical to `@turnkey/sdk-server`

## Usage

In order to run any of these scripts, from `sdk/examples/kitchen-sink`, you can run `pnpm tsx src/sdk-server/createEthereumWallet.ts` (where `sdk-server` can be replaced by `http`, and `createEthereumWallet.ts` can be replaced by any other script)
