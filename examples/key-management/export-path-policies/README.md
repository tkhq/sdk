# Example: `export-path-policies`

This example shows how to restrict wallet account exports by derivation path.
It uses the `wallet_account.path_indexes` and `wallet_account.path_hardened`
policy fields with `EXPORT_WALLET_ACCOUNT`.

The script uses a root API key. It creates a non-root API-only user and a
wallet with accounts on three derivation paths. It then verifies:

1. with no policy in place, the tester user is denied (baseline);
2. an ALLOW policy scoped to `m/8797555'/*'/3'/*'` (via `path_indexes` /
   `path_hardened`) permits only the in-subtree account, whose export bundle
   is decrypted locally;
3. accounts outside the subtree are denied;
4. an explicit DENY written against `path_indexes` wins over a broad ALLOW;
5. a policy that references an unsupported field (`wallet_account.path`) is
   rejected at creation time.

Use a fresh organization: existing policies can change the results above. The
script does not delete what it creates, and it prints each resource ID.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/key-management/export-path-policies/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By
following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart)
guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID

Once you've gathered these values, add them to a new `.env.local` file. Notice
that your API private key should be securely managed and **_never_** be
committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`

### 3/ Running the script

```bash
$ pnpm start
```

Sample output:

```
Created tester user with id: 93c0bedd-fd5c-413c-92fb-bd4d95d43c86
Created wallet with id: 899c4411-2d5b-52f5-beb6-de2d501589eb
- m/8797555'/0'/0'    030dc5e09c5082890533d41e1595cc3d42f8882f934d62fb81f53d1c8d840f038b
- m/8797555'/0'/3'/0' 02ea98bfbce4bd8eda77d1d3fcbcfce4ce5919b77e8a092dc93a104235dfba6b90
- m/44'/60'/0'/0/0    0x214Cc1a3DA4780Fa34e38dbFb7Ce9132A8a42513
Export of 02ea98bfbce4… denied as expected: Turnkey error 7: You don't have sufficient permissions to take this action. […] "message":"No policies evaluated to outcome: Allow","policyEvaluations":[] […]
Created subtree ALLOW policy with id: abffd94d-9167-4ab7-b9f4-73c427bab0b5
Exported the subtree account (decrypted a 64-character private key) ✅
Export of 030dc5e09c50… denied as expected: Turnkey error 7: […] "policyEvaluations":[{"policyId":"abffd94d-…","outcome":"OUTCOME_DENY_IMPLICIT"}] […]
Export of 0x214Cc1a3DA… denied as expected: Turnkey error 7: […] "policyEvaluations":[{"policyId":"abffd94d-…","outcome":"OUTCOME_DENY_IMPLICIT"}] […]
Exported the Ethereum account under the broad ALLOW ✅
Export of 0x214Cc1a3DA… denied as expected: Turnkey error 7: […] "message":"The following policies denied this action: cd889eab-…","policyEvaluations":[{"policyId":"abffd94d-…","outcome":"OUTCOME_DENY_IMPLICIT"},{"policyId":"bd73d310-…","outcome":"OUTCOME_ALLOW"},{"policyId":"cd889eab-…","outcome":"OUTCOME_DENY_EXPLICIT"}] […]
Exported the identity account (the DENY does not match it) ✅
Policy on wallet_account.path rejected as expected: Turnkey error 3: invalid policy condition: Expression cannot be evaluated: field does not exist: path (Details: [])
All checks passed ✅
```

Note: the long denial details and addresses are shortened with `…` above. The
real output includes the full `PolicyEnginePermissionError` payload, which
lists each policy's evaluation outcome.
