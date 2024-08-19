# Example: `with-offline`

This example shows how to sign a Turnkey request in offline contexts. Note that "offline" doesn't need to mean _actually_ offline. Producing a signed request without sending it to Turnkey has many different use cases:

- produce a signature on an actually offline laptop, then export that signed request to an online machine which has internet connectivity
- produce a signed Turnkey requests in a sandboxed browser environment (service worker, Chrome extension) which has access to API keys but isn't able to make direct network requests to Turnkey's API for security reasons. Instead, signed requests are forwarded to a backend component before hitting the Turnkey API. This emulates the setup from the previous bullet point
- produce signed Turnkey requests in browser contexts that can be forwarded to a backend application connected to Turnkey's API. While Turnkey allows browsers to POST directly to its API (open CORS policy), proxying to a backend has advantages: collecting metrics, feature toggle or circuit breakers, etc.

This example is similar, in spirit, to running our CLI (`turnkey request`) with the `--no-post` option set. When called with `--no-post`, [Turnkey's CLI](https://github.com/tkhq/tkcli) produces a stamp and displays the cURL command to use. We show the same thing here, but do it with TypeScript and rely on the Turnkey SDK typed helpers to generate the signed request components.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-offline/
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
- `ORGANIZATION_ID`
- `BASE_URL`: this is only used to output the right URL. No actual request will be made!

### 3/ Running the scripts

```bash
$ pnpm start
```

By default, this script will do the following:

1. Load your API key
2. Generates a signed request to create a new private key
3. Output the signed request components (URL, stamp, body), and also produces a ready-to-use `curl` command for quick testing

Here's a sample output:

```
$ pnpm start

Configuration loaded!
Creating a new Private Key for organization b8d8fa59-e1b7-4897-866a-551c32d061fa using the configured Turnkey API key...
? New Private Key Name: Hello
Your signed request details:
✅ Request URL:
        https://api.turnkey.com/public/v1/submit/create_private_keys
✅ Stamp header name and value
        X-Stamp: eyJwdWJsaWNLZXkiOiIwM2JmMTYyNTc2ZWI4ZGZlY2YzM2Q5Mjc1ZDA5NTk1Mjg0ZjZjNGRmMGRiNjE1NmMzYzU4Mjc3Nzg4NmEwZWUwYWMiLCJzY2hlbWUiOiJTSUdOQVRVUkVfU0NIRU1FX1RLX0FQSV9QMjU2Iiwic2lnbmF0dXJlIjoiMzA0NTAyMjAxOGNkNzVhYzUyZjhhMGQzMzdkZTZjMzJjOGNhODUyNDdlODQwYzQ2MDIxZWY1MjQ0MTJlYzFhNGFlNTAyNDMxMDIyMTAwZjRlZWQwZTJlMzExYTkyMDAzZmQ4MmFkMmQ2MTRkMDI2NGI2ZjUxNjkwNzA5MWFmMmFmZGNmOGZiOTVlY2IxMSJ9
✅ POST body:
        {"timestampMs":"1692804998969","type":"ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2","organizationId":"b8d8fa59-e1b7-4897-866a-551c32d061fa","parameters":{"privateKeys":[{"privateKeyName":"Hello","curve":"CURVE_SECP256K1","addressFormats":["ADDRESS_FORMAT_ETHEREUM"],"privateKeyTags":[]}]}}

For example, you can send this request to Turnkey by running the following cURL command:
        curl -X POST -d'{"timestampMs":"1692804998969","type":"ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2","organizationId":"b8d8fa59-e1b7-4897-866a-551c32d061fa","parameters":{"privateKeys":[{"privateKeyName":"Hello","curve":"CURVE_SECP256K1","addressFormats":["ADDRESS_FORMAT_ETHEREUM"],"privateKeyTags":[]}]}}' -H'X-Stamp:eyJwdWJsaWNLZXkiOiIwM2JmMTYyNTc2ZWI4ZGZlY2YzM2Q5Mjc1ZDA5NTk1Mjg0ZjZjNGRmMGRiNjE1NmMzYzU4Mjc3Nzg4NmEwZWUwYWMiLCJzY2hlbWUiOiJTSUdOQVRVUkVfU0NIRU1FX1RLX0FQSV9QMjU2Iiwic2lnbmF0dXJlIjoiMzA0NTAyMjAxOGNkNzVhYzUyZjhhMGQzMzdkZTZjMzJjOGNhODUyNDdlODQwYzQ2MDIxZWY1MjQ0MTJlYzFhNGFlNTAyNDMxMDIyMTAwZjRlZWQwZTJlMzExYTkyMDAzZmQ4MmFkMmQ2MTRkMDI2NGI2ZjUxNjkwNzA5MWFmMmFmZGNmOGZiOTVlY2IxMSJ9' -v 'https://api.turnkey.com/public/v1/submit/create_private_keys'

Important note: this request is only valid for 24hrs. After that, a new request needs to be generated.
```
