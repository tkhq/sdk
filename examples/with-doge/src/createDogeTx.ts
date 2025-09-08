import * as path from "path";
import * as dotenv from "dotenv";
import axios from "axios";
import * as bitcoin from "bitcoinjs-lib";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Dogecoin mainnet P2PKH (starts with 'D')
const SIGN_WITH = process.env.SIGNER_ADDRESS;
const DEST_ADDRESS = process.env.DEST_ADDRESS;

// 33-byte compressed public key hex for SIGNER_ADDRESS
const COMPRESSED_PUBKEY_HEX = process.env.SIGNER_ADDRESS_PUBKEY;

// Send 1 Doge with a 0.004 tx fee
const SEND_AMOUNT_SATS = 1e8;
const FEE_SATS = 400_000;

// Optional: manually preseed UTXOs; leave [] to auto-fetch
type UTXO = { txid: string; vout: number; valueSats: number };
const PRESEEDED_UTXOS: UTXO[] = [
  // { txid: '...', vout: 0, valueSats: 123_456_789 },
];

// Dogecoin mainnet (legacy P2PKH only)
const doge: bitcoin.networks.Network = {
  messagePrefix: "\x19Dogecoin Signed Message:\n",
  bech32: undefined as any,
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

// UTXO fetch
async function fetchUtxos(addr: string): Promise<UTXO[]> {
  if (PRESEEDED_UTXOS.length) return PRESEEDED_UTXOS;

  const { data } = await axios.get(
    `https://api.blockcypher.com/v1/doge/main/addrs/${addr}`,
    {
      params: { unspentOnly: true, includeScript: false },
      timeout: 15000,
    },
  );

  const txrefs = [...(data?.txrefs || []), ...(data?.unconfirmed_txrefs || [])];
  return (txrefs || []).map((t: any) => ({
    txid: t.tx_hash,
    vout: t.tx_output_n,
    valueSats: t.value,
  }));
}

// Greedy coin selection
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

// DER helpers (low-S normalization)
const strip0x = (h: string) => h.replace(/^0x/i, "");
const N = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
);
const N2 = N >> 1n;

function derToRS(derHex: string): { r: string; s: string } {
  const b = Buffer.from(strip0x(derHex), "hex");
  if (b.length < 2 || b[0] !== 0x30) throw new Error("Bad DER: no sequence");

  let off = 1;
  let len: number = b[off++]!;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) {
      if (off >= b.length) throw new Error("Bad DER: length overflow");
      len = (len << 8) | b[off++]!;
    }
  }

  if (b[off++] !== 0x02) throw new Error("Bad DER: r tag");
  const rlen: number = b[off++]!;
  if (off + rlen > b.length) throw new Error("Bad DER: r value out of range");
  const r = b.subarray(off, off + rlen);
  off += rlen;

  if (b[off++] !== 0x02) throw new Error("Bad DER: s tag");
  const slen: number = b[off++]!;
  if (off + slen > b.length) throw new Error("Bad DER: s value out of range");
  const s = b.subarray(off, off + slen);

  return { r: r.toString("hex"), s: s.toString("hex") };
}

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

// Turnkey signing, NO_OP over 32-byte digest
async function turnkeySignDigestHex(digestHex: string): Promise<string> {
  const tk = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const resp: any = await tk.apiClient().signRawPayloads({
    signWith: SIGN_WITH!,
    payloads: [digestHex],
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NO_OP",
  });

  const sig0 = resp?.signatures?.[0] || resp?.result?.signatures?.[0];
  if (!sig0) throw new Error("Turnkey: no signatures");

  if (sig0.r && sig0.s) {
    const { r, s } = toLowS(sig0.r, sig0.s);
    return rsToDer(r, s);
  }
  if (typeof sig0.signature === "string") {
    const { r, s } = derToRS(sig0.signature);
    const low = toLowS(r, s);
    return rsToDer(low.r, low.s);
  }
  throw new Error("Turnkey: unrecognized signature shape");
}

// Broadcast
async function broadcastTransaction(rawHex: string): Promise<string> {
  const { data } = await axios.post(
    `https://api.blockcypher.com/v1/doge/main/txs/push`,
    { tx: rawHex },
    { headers: { "Content-Type": "application/json" }, timeout: 20000 },
  );
  const hash = data?.tx?.hash || data?.hash;
  if (!hash)
    throw new Error(`BlockCypher broadcast failed: ${JSON.stringify(data)}`);
  return String(hash);
}

// Poll for confirmations
async function pollConfirm(txid: string, everyMs = 30_000, tries = 40) {
  for (let i = 1; i <= tries; i++) {
    const { data } = await axios.get(
      `https://api.blockcypher.com/v1/doge/main/txs/${txid}`,
      { timeout: 15000 },
    );
    const conf = data?.confirmations ?? 0;
    console.log(`[poll ${i}/${tries}] confirmations=${conf}`);
    if (conf >= 1) return data;
    await new Promise((res) => setTimeout(res, everyMs));
  }
  throw new Error(`Timeout waiting for confirmation: ${txid}`);
}

async function main() {
  if (!/^(02|03)[0-9a-f]{64}$/i.test(COMPRESSED_PUBKEY_HEX!)) {
    throw new Error(
      "COMPRESSED_PUBKEY_HEX must be a 33-byte compressed SEC key (02/03…).",
    );
  }

  const availableUtxos = PRESEEDED_UTXOS.length
    ? PRESEEDED_UTXOS
    : await fetchUtxos(SIGN_WITH!);

  const need = SEND_AMOUNT_SATS + FEE_SATS;
  const { picked: UTXOS, total: totalIn } = selectUtxos(availableUtxos, need);
  const change = totalIn - need;

  // Build legacy P2PKH
  const tx = new bitcoin.Transaction();
  tx.version = 1;
  for (const u of UTXOS) {
    tx.addInput(Buffer.from(u.txid, "hex").reverse(), u.vout, 0xffffffff);
  }
  tx.addOutput(
    bitcoin.address.toOutputScript(DEST_ADDRESS!, doge),
    SEND_AMOUNT_SATS,
  );
  if (change > 0) {
    tx.addOutput(bitcoin.address.toOutputScript(SIGN_WITH!, doge), change);
  }

  // Sign inputs (legacy sighash)
  const prevScript = bitcoin.address.toOutputScript(SIGN_WITH!, doge);
  const hashType = bitcoin.Transaction.SIGHASH_ALL;
  const pubkey = Buffer.from(COMPRESSED_PUBKEY_HEX!, "hex");

  for (let i = 0; i < UTXOS.length; i++) {
    const digest = tx.hashForSignature(i, prevScript, hashType);
    const digestHex = Buffer.from(digest).toString("hex");
    const derHex = await turnkeySignDigestHex(digestHex);
    const sigWithType = Buffer.concat([
      Buffer.from(derHex, "hex"),
      Buffer.from([hashType & 0xff]),
    ]);
    const scriptSig = bitcoin.script.compile([sigWithType, pubkey]);
    tx.setInputScript(i, scriptSig);
  }

  const rawHex = tx.toHex();
  console.log("Raw Dogecoin tx hex:\n", rawHex);

  // Broadcast via BlockCypher
  const txHash = await broadcastTransaction(rawHex);
  console.log("TX hash:", txHash);

  // Poll for a confirmation via BlockCypher
  await pollConfirm(txHash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
