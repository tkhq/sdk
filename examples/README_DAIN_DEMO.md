# Dain's Demo


This README covers setup and usage for three Turnkey SDK examples:
- **Kitchen Sink**: create an Ethereum wallet inside your Turnkey organization
- **Sweeper**: sweep ERC-20 token balances into a single destination address
- **CreatePolicy**: define and register an org policy with effect, consensus, and conditions


### 1/ Setting up Turnkey

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

1. Setting up Ethereum Wallet for User

In order to run any of these scripts, from `sdk/examples/kitchen-sink`, you can run `pnpm tsx src/sdk-server/createEthereumWallet.ts` (where `sdk-server` can be replaced by `http`, and `createEthereumWallet.ts` can be replaced by any other script)

2. Running Sweeper Function
copy the .env.local that you created from your kitchen-sink folder and add it to the sweeper folder. You will be using the same credentials. 

replace 'destination address' to omnibus address you'd like to sweep to. 

I've added the 'sweep' script which will run the index.ts file instead of builing-all every time we run start in order to save time. 

Within the sweeper directory you may run `pnpm sweeper` to run the function and sign the transaction to sweep to your chosen omnibus address 

3. Create Policy

Fill out the variables
- `policyName`
- `effect`
- `consensus`
- `condition`

## Consensus and Condition (Policy Basics)

Turnkey policies are JSON rules that decide whether an activity is allowed or denied. The final `effect` (`EFFECT_ALLOW` or `EFFECT_DENY`) is determined by evaluating two expressions:

- **consensus**: who must approve the activity (users, tags, or credential types)
- **condition**: when the policy applies (what action, wallet, chain, tx fields, etc.)

Both `consensus` and `condition` are written in Turnkey’s policy language and must evaluate to `true`. :contentReference[oaicite:0]{index=0}

### Consensus: who can approve

Common patterns:

- **Single user**  
  ```json
  "consensus": "approvers.any(user, user.id == '<USER_ID>')"

run `pnpm tsx src/sdk-server/createPolicy.ts` to create a new policy. 

