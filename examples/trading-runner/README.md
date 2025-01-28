# Example: `trading-runner`

A sample application demonstrating a trading operation, using various private keys, users, and policies, powered by Uniswap.

**Note:** This example runs on Goerli, as Uniswap is not yet available on Sepolia.

## Scenario

A trading firm has two types of accounts: Trading and Long Term Storage.

**Trading:** This is the account in which trading will take place. `Admin` users can act unilaterally on behalf of such wallets, and `trader`s are limited in scope as to the transactions they're able to execute.

**Long Term Storage:** This is an account that is intended to hold funds for an extended of time. While `trader` types are able to send funds to such addresses, only `admin` users can send funds out.

Once the tags, private keys, and policies are initialized and the `trading` account is funded, users can begin trading. `Admin`s can trade freely, and `trader`s can execute transactions based on the predetermined policies using the `trade` command. Afterwards, `admin`s can sweep funds to the destination of their choice, while `trader`s can only send assets to destinations based, again, on the predetermined policies.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/trading-runner/
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
- `INFURA_KEY` -- if this is not set, it will default to using the Community Infura key

### 3/ Setup

Create the organizational structure required for this demo:

```bash
// setup an organization with users, private keys, and policies
pnpm cli setup
```

### 4/ Pre-Fund

Before executing any txns using Turnkey, you'll first need the "Trading" address to have some funds. In the Turnkey dashboard, look up the address for "Trading" and then send some funds to it from an external wallet or directly from a [faucet](https://goerlifaucet.com/).

### 5/ Trade

Once the "Trading" address has funds in it, execute the "trade" command to exchange a base asset for the quote asset, for a specified amount.

```bash
pnpm cli trade --baseAsset=<SYMBOL> --quoteAsset=<SYMBOL> --baseAmount=<WHOLE AMOUNT> --key=<USER>
```

Note: when trading ETH using Uniswap v2/v3, wrapping and unwrapping ETH/WETH will be handled under the hood.

### 6/ Sweep

Next, use the "sweep" command to move the assets from the "Trading" address(es) to the "Long Term Storage" address(es).

```bash
pnpm cli sweep --asset=<ASSET> --destination=<ADDRESS> --amount=<WHOLE AMOUNT> --key=<USER>
```

Notes:

- User `bob` will be denied due to the policies if he attempts to send funds to an unauthorized destination.
- If a `destination` is not specified, it will default to sending to the `Long Term Storage` address.
- If an `amount` is not specified, it will default to sending the ~entire balance.

## Sample trades

```bash
pnpm cli trade --baseAsset=ETH --quoteAsset=USDC --baseAmount=0.001 --key=bob # will auto-wrap ETH into WETH
pnpm cli trade --baseAsset=WETH --quoteAsset=USDC --baseAmount=0.001 --key=bob
pnpm cli trade --baseAsset=USDC --quoteAsset=WETH --baseAmount=1000 --key=bob
pnpm cli trade --baseAsset=USDC --quoteAsset=ETH --baseAmount=1000 --key=bob # will auto-unwrap WETH into ETH
```

## Sample sweeps

```bash
pnpm cli sweep --asset=USDC --amount=1 --key=bob
pnpm cli sweep --asset=USDC --amount=1 --key=bob --destination=0xf0609e87Dfa4DA10f38313868b15296f7B30c00A # will get denied
```

## Understanding policies

First, see our [Policies docs](https://docs.turnkey.com/managing-policies/overview) for a primer on how policies work and are written. You'll notice that the policies used in this demo make use of directly accessing the transaction data of the Ethereum transactions. For example, let's break down the transaction data for an ERC20 `transfer`, specifically USDC ([Etherscan link](https://goerli.etherscan.io/tx/0x11a4f4c0778ddbf7731cab1b07d7db577918397c47bf3270ea9016237c8d4d11)):

```
0xa9059cbb000000000000000000000000d3b433723858612da3260eac465758c7ddfa5e5000000000000000000000000000000000000000000000000000000000000f4240
```

The function selector is stored in the first 4 bytes after the `0x`, i.e. the first 8 hex characters. This evaluates to `a9059cbb`, and because our policy engine includes the `0x` prefix, this is why the policy checks the first ten characters (`eth.tx.data[0..10]`) to see if it equates to `0xa9059cbb`.

Next, we have 2 static parameters, `to (address)` and `value (uint256)`, which each conform to the invariant that EVM call data parameters consist of 32 bytes, or 64 hex characters, left-padded with 0s (if necessary). Similar to accessing the `selector` chars, we can hone in on the `to` chars with `eth.tx.data[10..74]`, and `value` chars with `eth.tx.data[74..138]`. Note that these bits will not be 0x-prefixed, so we are comparing pure hex chars. In summary:

```javascript
eth.tx.data[0..10]: "0xa9059cbb"
eth.tx.data[10..74]: "000000000000000000000000d3b433723858612da3260eac465758c7ddfa5e50"
eth.tx.data[74..138]: "00000000000000000000000000000000000000000000000000000000000f4240"
```

Additional note: the policies specified in this example are separate for the purposes of clarity. However, certain causes can be combined as well. For example:
These two calls

```javascript
await createPolicy(
  "Traders can use trading keys to deposit, aka wrap, ETH",
  "EFFECT_ALLOW",
  `approvers.any(user, user.tags.contains('${traderTagId}'))`,
  `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${WETH_TOKEN_GOERLI.address}' && eth.tx.data[0..10] == '${DEPOSIT_SELECTOR}'`
);
await createPolicy(
  "Traders can use trading keys to withdraw, aka unwrap, WETH",
  "EFFECT_ALLOW",
  `approvers.any(user, user.tags.contains('${traderTagId}'))`,
  `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${WETH_TOKEN_GOERLI.address}' && eth.tx.data[0..10] == '${WITHDRAW_SELECTOR}'`
);
```

... can alternatively be expressed as

```javascript
await createPolicy(
  "Traders can use trading keys to wrap or unwrap ETH",
  "EFFECT_ALLOW",
  `approvers.any(user, user.tags.contains('${traderTagId}'))`,
  `private_key.tags.contains('${tradingTagId}') && eth.tx.to == '${WETH_TOKEN_GOERLI.address}' && eth.tx.data[0..10] in ['${DEPOSIT_SELECTOR}', '${WITHDRAW_SELECTOR}']`
);
```
