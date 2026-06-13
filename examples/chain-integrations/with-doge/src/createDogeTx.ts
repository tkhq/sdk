import * as path from "path";
import * as dotenv from "dotenv";
import axios from "axios";
import * as bitcoin from "bitcoinjs-lib";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Electrs API for Doge testnet
const ELECTRS = "https://doge-electrs-testnet-demo.qed.me";

// Make sure to useDoge testnet addresses
const SIGN_WITH = process.env.SIGNER_ADDRESS!;
const DEST_ADDRESS = process.env.DEST_ADDRESS!;
const COMPRESSED_PUBKEY_HEX = process.env.SIGNER_ADDRESS_PUBKEY!;

// Send 0.01 DOGE with a 0.001 Fee
const SEND_AMOUNT_SATS = 1_000_000;
const FEE_SATS = 100_000;

type UTXO = { txid: string; vout: number; valueSats: number };

// Dogecoin TESTNET (legacy P2PKH)
// These parameters tell bitcoinjs-lib how to serialize/deserialize Dogecoin testnet keys, addresses, and transactions.
const dogeTestnet: bitcoin.networks.Network = {
  // Prefix added when signing arbitrary messages (not used for tx signatures)
  messagePrefix: "\x19Dogecoin Signed Message:\n",
  // Dogecoin doesn’t use bech32 addresses (no native segwit), so disable it
  bech32: undefined as any,
  // BIP32 HD wallet version bytes (testnet standard: same as Bitcoin testnet)
  // Used when deriving extended keys (xpub/xprv) for testnet
  bip32: { public: 0x043587cf, private: 0x04358394 },
  // Version byte for P2PKH addresses, produces addresses starting with "n" or "m"
  pubKeyHash: 0x71,
  // Version byte for P2SH addresses, produces addresses starting with "2", not used for P2PKH
  scriptHash: 0xc4,
  // Prefix byte for WIF (Wallet Import Format) private keys on Dogecoin testnet
  wif: 0xf1,
};

// Fetch unspent UTXOs from the Electrs API
async function getUtxos(addr: string) {
  const { data } = await axios.get(`${ELECTRS}/address/${addr}/utxo`, {
    timeout: 20_000,
  });
  return (data as Array<{ txid: string; vout: number; value: number }>).map(
    (u) => ({
      txid: u.txid,
      vout: u.vout,
      valueSats: Math.round(u.value),
    }),
  ) as UTXO[];
}

// Gather enough inputs to fund the transaction
// Sorts UTXOs largest→smallest, picks until sum ≥ need (where need = amount + fee)
function selectUtxos(utxos: UTXO[], need: number) {
  const sorted = [...utxos].sort((a, b) => b.valueSats - a.valueSats);
  const picked: UTXO[] = [];
  let total = 0;
  for (const u of sorted) {
    picked.push(u);
    total += u.valueSats;
    if (total >= need) break;
  }
  if (total < need)
    throw new Error(`Insufficient funds: need ${need}, have ${total}`);
  return { picked, total };
}

// Broadcast raw transaction
async function broadcastTransaction(rawHex: string) {
  const { data } = await axios.post(`${ELECTRS}/tx`, rawHex, {
    headers: { "Content-Type": "text/plain" },
    timeout: 20_000,
    transformRequest: [(d) => d],
  });
  return String(data);
}

// Poll for tx confirmation
async function pollConfirm(txid: string, everyMs = 30_000, tries = 40) {
  for (let i = 1; i <= tries; i++) {
    try {
      const { data } = await axios.get(`${ELECTRS}/tx/${txid}/status`, {
        timeout: 15_000,
      });
      const confirmed: boolean = Boolean(data?.confirmed);
      console.log(`[poll ${i}/${tries}] confirmed=${confirmed}`);
      if (confirmed) return data;
    } catch (err: any) {
      if (err.response?.status === 429) {
        console.warn("Electrs rate limit hit. Sleeping 1s before retry...");
        await new Promise((r) => setTimeout(r, 1000));
        i--; // don’t count this attempt
        continue;
      }
      throw err;
    }
    await new Promise((r) => setTimeout(r, everyMs));
  }
  throw new Error(`Timeout waiting for confirmation: ${txid}`);
}

// Low-S & DER helpers
// strip0x: utility to normalize hex strings by removing a leading "0x" if present
const strip0x = (h: string) => h.replace(/^0x/i, "");
// N = order of the secp256k1 elliptic curve group (used in Bitcoin/Dogecoin signatures).
// This constant is needed to enforce the "low-S" rule: signatures with s > N/2 are flipped
// to s' = N - s so that all signatures are canonical and mempool-standard.
const N = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
);
const N2 = N >> 1n;

function toLowS(rHex: string, sHex: string) {
  const r = BigInt("0x" + strip0x(rHex));
  let s = BigInt("0x" + strip0x(sHex));
  if (s > N2) s = N - s;
  return {
    r: r.toString(16).padStart(64, "0"),
    s: s.toString(16).padStart(64, "0"),
  };
}

function rsToDer(rHex: string, sHex: string): string {
  function trim(buf: Buffer): Buffer {
    let i = 0;
    while (i < buf.length - 1 && buf[i] === 0) i++;
    const v = buf.subarray(i);
    if (v.length === 0) throw new Error("Bad DER: empty integer");
    return v[0]! & 0x80 ? Buffer.concat([Buffer.from([0x00]), v]) : v;
  }
  const r = trim(Buffer.from(strip0x(rHex), "hex"));
  const s = trim(Buffer.from(strip0x(sHex), "hex"));
  const rSeq = Buffer.concat([Buffer.from([0x02, r.length]), r]);
  const sSeq = Buffer.concat([Buffer.from([0x02, s.length]), s]);
  const body = Buffer.concat([rSeq, sSeq]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]).toString(
    "hex",
  );
}

// Sign with Turnkey (single payload, NO_OP)
async function turnkeySignDigestHex(digestHex: string): Promise<string> {
  const tk = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const resp: any = await tk.apiClient().signRawPayload({
    signWith: SIGN_WITH!,
    payload: digestHex,
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NO_OP",
  });

  const sr =
    resp?.result?.signRawPayloadResult ??
    resp?.activity?.result?.signRawPayloadResult;

  if (!sr?.r || !sr?.s) {
    throw new Error(
      `Turnkey: missing r/s in response: ${JSON.stringify(resp)}`,
    );
  }

  const { r, s } = toLowS(sr.r, sr.s);
  return rsToDer(r, s);
}

async function main() {
  if (!/^(02|03)[0-9a-f]{64}$/i.test(COMPRESSED_PUBKEY_HEX)) {
    throw new Error(
      "SIGNER_ADDRESS_PUBKEY must be a 33-byte compressed SEC key (hex starting 02/03).",
    );
  }

  // 1) Fetch UTXOs from Electrs
  const utxos = await getUtxos(SIGN_WITH);
  if (!utxos.length) {
    throw new Error(
      "No UTXOs found for SIGNER_ADDRESS on testnet (fund it via the faucet first).",
    );
  }

  // 2) Select inputs & compute change
  const need = SEND_AMOUNT_SATS + FEE_SATS;
  const { picked: UTXOS, total: totalIn } = selectUtxos(utxos, need);
  const change = totalIn - need;

  console.log("Network: dogecoin testnet (legacy P2PKH)");
  console.log(
    "Inputs (sats):",
    totalIn,
    "Send:",
    SEND_AMOUNT_SATS,
    "Fee:",
    FEE_SATS,
    "Change:",
    change,
  );

  // 3) Build a legacy P2PKH transaction
  const tx = new bitcoin.Transaction();
  tx.version = 1;

  // Add each UTXO as an input to the transaction.
  // - txid is reversed because raw tx format stores it little-endian
  // - vout selects which output index to spend
  // - 0xffffffff marks the input sequence as "final" (no RBF/timelock)
  for (const u of UTXOS) {
    tx.addInput(Buffer.from(u.txid, "hex").reverse(), u.vout, 0xffffffff);
  }

  tx.addOutput(
    bitcoin.address.toOutputScript(DEST_ADDRESS, dogeTestnet),
    SEND_AMOUNT_SATS,
  );
  if (change > 0) {
    // Add outputs: one paying the recipient, and one returning change back to the sender (if any).
    tx.addOutput(
      bitcoin.address.toOutputScript(SIGN_WITH, dogeTestnet),
      change,
    );
  }

  // 4) Sign each input
  const prevScript = bitcoin.address.toOutputScript(SIGN_WITH, dogeTestnet);
  const hashType = bitcoin.Transaction.SIGHASH_ALL;
  const pubkey = Buffer.from(COMPRESSED_PUBKEY_HEX, "hex");

  for (let i = 0; i < UTXOS.length; i++) {
    const digest = tx.hashForSignature(i, prevScript, hashType);
    const derHex = await turnkeySignDigestHex(
      Buffer.from(digest).toString("hex"),
    );
    // Append the SIGHASH flag (0x01 = SIGHASH_ALL) as a single byte to the DER-encoded signature.
    // The "& 0xff" ensures only the lowest 8 bits of the hashType are used.
    // Bitcoin/Dogecoin consensus requires every tx signature to end with this flag byte so
    // the network knows which parts of the transaction were signed.
    const sigWithType = Buffer.concat([
      Buffer.from(derHex, "hex"),
      Buffer.from([hashType & 0xff]),
    ]);
    const scriptSig = bitcoin.script.compile([sigWithType, pubkey]);
    tx.setInputScript(i, scriptSig);
    // Add a small delay if signing multiple inputs, to avoid rate limits
    if (UTXOS.length > 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  // 5) Serialize & broadcast via Electrs
  const rawHex = tx.toHex();
  console.log("Raw Dogecoin testnet tx hex:\n", rawHex);
  console.log("Bytes:", rawHex.length / 2);

  const txid = await broadcastTransaction(rawHex);
  console.log("Broadcasted txid:", txid);
  console.log(`Explorer: https://doge-testnet-explorer.qed.me/tx/${txid}`);

  // 6) Poll for confirmation
  await pollConfirm(txid);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
