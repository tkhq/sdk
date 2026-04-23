/**
 * Deposit: Bitcoin L1 → Spark
 *
 * Gets a single-use deposit address, sends BTC via regtest, mines a
 * block, and claims the deposit into Spark. FROST signing is handled
 * by Turnkey's SPARK_PREPARE_AND_SIGN activity.
 *
 * Required env vars:
 *   API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *   TURNKEY_SPARK_ADDRESS, IDENTITY_PUBLIC_KEY_HEX
 *
 * Optional:
 *   DEPOSIT_AMOUNT_SATS (default: 100000)
 *   BITCOIN_RPC_URL, BITCOIN_RPC_USER, BITCOIN_RPC_PASS
 */

import { initSparkWallet, env } from "./init";

interface BitcoinRpc {
  url: string;
  user: string;
  pass: string;
}

async function bitcoinRpc(
  rpc: BitcoinRpc,
  method: string,
  params: unknown[] = [],
): Promise<unknown> {
  const response = await fetch(rpc.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " + Buffer.from(`${rpc.user}:${rpc.pass}`).toString("base64"),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = (await response.json()) as { result: unknown; error?: unknown };
  if (data.error) throw new Error(`bitcoind ${method}: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function main() {
  const depositSats = Number(env("DEPOSIT_AMOUNT_SATS", "100000"));
  const btcRpc: BitcoinRpc = {
    url: env("BITCOIN_RPC_URL", "http://127.0.0.1:18443"),
    user: env("BITCOIN_RPC_USER", "user"),
    pass: env("BITCOIN_RPC_PASS", "pass"),
  };

  const { wallet } = await initSparkWallet();
  console.log(`Authenticated to Spark SO`);

  const depositAddress = await wallet.getSingleUseDepositAddress();
  console.log(`Deposit P2TR address: ${depositAddress}`);

  const depositBtc = depositSats / 1e8;
  console.log(`Sending ${depositBtc} BTC via regtest...`);
  const txid = await bitcoinRpc(btcRpc, "sendtoaddress", [depositAddress, depositBtc]) as string;
  console.log(`L1 txid: ${txid}`);

  console.log(`Mining 1 block...`);
  const addr = (await bitcoinRpc(btcRpc, "getnewaddress")) as string;
  await bitcoinRpc(btcRpc, "generatetoaddress", [1, addr]);

  console.log(`Claiming deposit...`);
  await wallet.claimDeposit(txid);

  const balance = await wallet.getBalance();
  console.log(`Balance: ${balance.satsBalance?.available ?? 0} sats available`);

  console.log(`\nDone.`);
  wallet.cleanupConnections();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
