# @turnkey/http

[![npm](https://img.shields.io/npm/v/@turnkey/http?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/http)

A lower-level, fully typed HTTP client for interacting with [Turnkey](https://turnkey.com) API.

For signing transactions and messages, check out the higher-level [`@turnkey/ethers`](https://www.npmjs.com/package/@turnkey/ethers) or [`@turnkey/viem`](https://www.npmjs.com/package/@turnkey/viem) signers.

Turnkey API documentation lives here: https://docs.turnkey.com.

## Getting started

```bash
$ npm install @turnkey/http
```

```typescript
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeyClient } from "@turnkey/http";

// This stamper produces signatures using the API key pair passed in.
const stamper = new ApiKeyStamper({
  apiPublicKey: "...",
  apiPrivateKey: "...",
});

// The Turnkey client uses the passed in stamper to produce signed requests
// and sends them to Turnkey
const client = new TurnkeyClient(
  {
    baseUrl: "https://api.turnkey.com",
  },
  stamper
);

// Now you can make authenticated requests!
const data = await client.getWhoami({
  organizationId: "<Your organization id>",
});
```

## HTTP fetchers

`@turnkey/http` provides fully typed http fetchers for interacting with the Turnkey API. You can find all available methods [here](/packages/http/src/__generated__/services/coordinator/public/v1/public_api.fetcher.ts). The types of input parameters and output responses are also exported for convenience.

The OpenAPI spec that generates all fetchers is also [included](/packages/http/src/__generated__/services/coordinator/public/v1/public_api.swagger.json) in the package.

## `withAsyncPolling(...)` helper

All Turnkey mutation endpoints are asynchronous (with the exception of private key-related signing endpoints, e.g. `/submit/sign_transaction`, `/submit/sign_raw_payload`). To help you simplify async mutations, `@turnkey/http` provides a `withAsyncPolling(...)` wrapper. Here's a quick example:

```typescript
import { withAsyncPolling, TurnkeyActivityError } from "@turnkey/http";

// Use `withAsyncPolling(...)` to wrap & create a fetcher with built-in async polling support
const fetcher = withAsyncPolling({
  request: client.createPrivateKeys,
});

// The fetcher remains fully typed. After submitting the request,
// it'll poll until the activity reaches a terminal state.
try {
  const activity = await fetcher({
    body: {
      /* ... */
    },
  });

  // Success!
  console.log(
    activity.result.createPrivateKeysResultV2?.privateKeys?.[0]?.privateKeyId
  );
} catch (error) {
  if (error instanceof TurnkeyActivityError) {
    // In case the activity is rejected, failed, or requires consensus,
    // a rich `TurnkeyActivityError` will be thrown. You can read from
    // `TurnkeyActivityError` to find out why the activity didn't succeed.
    //
    // For instance, if your activity requires consensus and doesn't have
    // enough approvals, you can get the `activityId` from `TurnkeyActivityError`,
    // store it somewhere, then re-fetch the activity via `.postGetActivity(...)`
    // when the required approvals/rejections are in place.
  }
}
```

## More examples

See [`createNewEthereumPrivateKey.ts`](/examples/with-ethers/src/createNewEthereumPrivateKey.ts) in the [`with-ethers`](/examples/with-ethers/) example.

## See also

- [`@turnkey/ethers`](https://www.npmjs.com/package/@turnkey/ethers): Turnkey Signer for [`Ethers`](https://docs.ethers.org/v6/api/providers/#Signer)
- [`@turnkey/viem`](https://www.npmjs.com/package/@turnkey/viem): Turnkey Custom Account for [`Viem`](https://viem.sh/docs/accounts/custom.html)
