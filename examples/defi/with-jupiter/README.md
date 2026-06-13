# with-jupiter

An example app that integrates [Turnkey](https://turnkey.com) with [Jupiter’s Ultra Swap](https://station.jup.ag/docs/apis/ultra-api) to demonstrate Solana token swaps directly from a Turnkey-managed wallet.

This project shows how to:

- Authenticate and manage Solana wallets using `@turnkey/react-wallet-kit`
- Sign Solana transactions using `@turnkey/solana`
- Create and execute Jupiter Ultra orders with a connected wallet

---

## Features

- **Login with Turnkey** → authenticate and load available wallets
- **Select wallet account** → choose which account to use for swaps
- **Swap tokens** → trigger USDC → SOL or SOL → USDC swaps via Jupiter Ultra
- **Transaction signing** → handled by Turnkey signer (`TurnkeySigner`)
- **Status updates** → real-time UI updates with clickable Solscan links

---

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router, Client Components)
- [@turnkey/react-wallet-kit](https://www.npmjs.com/package/@turnkey/react-wallet-kit)
- [@turnkey/solana](https://www.npmjs.com/package/@turnkey/solana)
- [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/)
- Jupiter Ultra API

---

## Getting Started

1. **Install dependencies**

   ```bash
   pnpm install
   # or
   npm install
   ```

2. **Set environment variables**  
   Create a `.env.local` file with:

   ```env
    NEXT_PUBLIC_BASE_URL="https://api.turnkey.com"
    NEXT_PUBLIC_ORGANIZATION_ID="1875b49b-22ad-42c6-949f-04d5dd03ee3a"
    NEXT_PUBLIC_AUTH_PROXY_URL="https://authproxy.turnkey.com/"
    NEXT_PUBLIC_AUTH_PROXY_ID="a70d82ef-4373-467a-a189-9be44629799b"

   ```

3. **Run the app**

   ```bash
   pnpm dev
   # or
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) and log in with Turnkey.
   - Select a wallet account
   - Try swapping USDC ↔ SOL
   - Check the transaction on [Solscan](https://solscan.io)
