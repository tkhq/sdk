import * as path from "path";
import * as dotenv from "dotenv";
import { blake2b } from "@noble/hashes/blake2b";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const VERSION_GROUP_ID = 0x26a7270a;
const OVERWINTERED_VERSION_5 = 0x80000005;
const SIGHASH_ALL = 0x01;
const FINAL_SEQUENCE = 0xffffffff;
const MAX_MONEY_ZATOSHIS = 21_000_000n * 100_000_000n;
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_LOOKUP = new Map(
  [...BASE58_ALPHABET].map((character, index) => [character, index]),
);

const PREFIXES = {
  mainnet: {
    p2pkh: "1cb8",
    p2sh: "1cbd",
  },
  testnet: {
    p2pkh: "1d25",
    p2sh: "1cba",
  },
} as const;

type ZcashNetwork = keyof typeof PREFIXES;

type Utxo = {
  txid: string;
  vout: number;
  valueZatoshis: bigint;
  scriptPubKey?: Uint8Array;
};

type TxInput = {
  txid: string;
  vout: number;
  valueZatoshis: bigint;
  scriptPubKey: Uint8Array;
  sequence: number;
  scriptSig: Uint8Array;
};

type TxOutput = {
  valueZatoshis: bigint;
  scriptPubKey: Uint8Array;
};

class ZcashRpc {
  private id = 0;

  constructor(
    private readonly url: string,
    private readonly username?: string,
    private readonly password?: string,
  ) {}

  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.username || this.password) {
      headers.Authorization =
        "Basic " +
        Buffer.from(`${this.username ?? ""}:${this.password ?? ""}`).toString(
          "base64",
        );
    }

    const response = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "1.0",
        id: `turnkey-zcash-${++this.id}`,
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`Zcash RPC ${method} failed: HTTP ${response.status}`);
    }

    const json: any = await response.json();
    if (json.error) {
      throw new Error(`Zcash RPC ${method} failed: ${json.error.message}`);
    }

    return json.result as T;
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.includes("<optional")) {
    return undefined;
  }
  return value;
}

function strip0x(hex: string): string {
  return hex.replace(/^0x/i, "");
}

function fromHex(hex: string): Uint8Array {
  const normalized = strip0x(hex);
  if (normalized.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(normalized)) {
    throw new Error(`Invalid hex string: ${hex}`);
  }
  return Uint8Array.from(Buffer.from(normalized, "hex"));
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function ascii(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "ascii"));
}

function uint8(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff);
}

function uint32LE(value: number): Uint8Array {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return Uint8Array.from(buffer);
}

function int64LE(value: bigint): Uint8Array {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(value, 0);
  return Uint8Array.from(buffer);
}

function compactSize(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid CompactSize value ${value}`);
  }

  if (value < 0xfd) {
    return Uint8Array.of(value);
  }

  if (value <= 0xffff) {
    const buffer = Buffer.alloc(3);
    buffer[0] = 0xfd;
    buffer.writeUInt16LE(value, 1);
    return Uint8Array.from(buffer);
  }

  if (value <= 0xffffffff) {
    const buffer = Buffer.alloc(5);
    buffer[0] = 0xfe;
    buffer.writeUInt32LE(value, 1);
    return Uint8Array.from(buffer);
  }

  const buffer = Buffer.alloc(9);
  buffer[0] = 0xff;
  buffer.writeBigUInt64LE(BigInt(value), 1);
  return Uint8Array.from(buffer);
}

function bytesWithCompactSize(bytes: Uint8Array): Uint8Array {
  return concatBytes([compactSize(bytes.length), bytes]);
}

function blake2b256(
  personalization: string | Uint8Array,
  data: Uint8Array,
): Uint8Array {
  const personal =
    typeof personalization === "string"
      ? ascii(personalization)
      : personalization;

  if (personal.length !== 16) {
    throw new Error(
      `BLAKE2b personalization must be exactly 16 bytes; got ${personal.length}`,
    );
  }

  return blake2b(data, {
    dkLen: 32,
    personalization: personal,
  });
}

function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}

function doubleSha256(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

function encodeBase58(payload: Uint8Array): string {
  let leadingZeros = 0;
  for (const byte of payload) {
    if (byte !== 0) {
      break;
    }
    leadingZeros++;
  }

  let value = BigInt(`0x${bytesToHex(payload) || "0"}`);
  let encoded = "";
  while (value > 0n) {
    const digit = Number(value % 58n);
    encoded = BASE58_ALPHABET[digit]! + encoded;
    value /= 58n;
  }

  return "1".repeat(leadingZeros) + encoded;
}

function decodeBase58(value: string): Uint8Array {
  let leadingZeros = 0;
  for (const character of value) {
    if (character !== "1") {
      break;
    }
    leadingZeros++;
  }

  let decoded = 0n;
  for (const character of value) {
    const digit = BASE58_LOOKUP.get(character);
    if (digit === undefined) {
      throw new Error(`Invalid Base58 character: ${character}`);
    }
    decoded = decoded * 58n + BigInt(digit);
  }

  const hex = decoded.toString(16);
  const body =
    decoded === 0n
      ? new Uint8Array()
      : fromHex(hex.length % 2 === 0 ? hex : `0${hex}`);
  return concatBytes([new Uint8Array(leadingZeros), body]);
}

function encodeBase58Check(payload: Uint8Array): string {
  const checksum = doubleSha256(payload).subarray(0, 4);
  return encodeBase58(concatBytes([payload, checksum]));
}

function decodeBase58Check(value: string): Uint8Array {
  const decoded = decodeBase58(value);
  if (decoded.length < 4) {
    throw new Error("Invalid Base58Check payload");
  }

  const payload = decoded.subarray(0, -4);
  const checksum = decoded.subarray(-4);
  const expected = doubleSha256(payload).subarray(0, 4);
  if (bytesToHex(checksum) !== bytesToHex(expected)) {
    throw new Error("Invalid Base58Check checksum");
  }

  return payload;
}

function normalizeNetwork(value = "testnet"): ZcashNetwork {
  if (value !== "mainnet" && value !== "testnet") {
    throw new Error("ZCASH_NETWORK must be mainnet or testnet");
  }
  return value;
}

function validateCompressedPublicKey(hex: string): Uint8Array {
  const bytes = fromHex(hex);
  if (bytes.length !== 33 || (bytes[0] !== 0x02 && bytes[0] !== 0x03)) {
    throw new Error(
      "SIGNER_COMPRESSED_PUBLIC_KEY must be a 33-byte compressed secp256k1 public key starting with 02 or 03",
    );
  }
  return bytes;
}

function isCompressedPublicKeyHex(value: string): boolean {
  return /^(02|03)[0-9a-f]{64}$/i.test(strip0x(value));
}

function deriveP2pkhAddress(
  compressedPublicKey: Uint8Array,
  network: ZcashNetwork,
): string {
  const prefix = fromHex(PREFIXES[network].p2pkh);
  return encodeBase58Check(concatBytes([prefix, hash160(compressedPublicKey)]));
}

function decodeTransparentAddress(
  address: string,
  network: ZcashNetwork,
): {
  kind: "p2pkh" | "p2sh";
  hash: Uint8Array;
} {
  const decoded = decodeBase58Check(address);
  if (decoded.length !== 22) {
    throw new Error(`Invalid transparent address length for ${address}`);
  }

  const prefix = bytesToHex(decoded.subarray(0, 2));
  const hash = decoded.subarray(2);

  if (prefix === PREFIXES[network].p2pkh) {
    return { kind: "p2pkh", hash };
  }

  if (prefix === PREFIXES[network].p2sh) {
    return { kind: "p2sh", hash };
  }

  throw new Error(
    `${address} is not a ${network} transparent address supported by this example`,
  );
}

function p2pkhScript(pubKeyHash: Uint8Array): Uint8Array {
  if (pubKeyHash.length !== 20) {
    throw new Error("P2PKH hash must be 20 bytes");
  }

  return concatBytes([
    Uint8Array.of(0x76, 0xa9, 0x14),
    pubKeyHash,
    Uint8Array.of(0x88, 0xac),
  ]);
}

function p2shScript(scriptHash: Uint8Array): Uint8Array {
  if (scriptHash.length !== 20) {
    throw new Error("P2SH hash must be 20 bytes");
  }

  return concatBytes([
    Uint8Array.of(0xa9, 0x14),
    scriptHash,
    Uint8Array.of(0x87),
  ]);
}

function scriptForTransparentAddress(
  address: string,
  network: ZcashNetwork,
): Uint8Array {
  const decoded = decodeTransparentAddress(address, network);
  return decoded.kind === "p2pkh"
    ? p2pkhScript(decoded.hash)
    : p2shScript(decoded.hash);
}

function p2pkhScriptForTransparentAddress(
  address: string,
  network: ZcashNetwork,
): Uint8Array {
  const decoded = decodeTransparentAddress(address, network);
  if (decoded.kind !== "p2pkh") {
    throw new Error(`Source address ${address} must be a P2PKH t-address`);
  }

  return p2pkhScript(decoded.hash);
}

function serializeOutpoint(input: Pick<TxInput, "txid" | "vout">): Uint8Array {
  const txid = fromHex(input.txid);
  if (txid.length !== 32) {
    throw new Error(`Invalid txid length for ${input.txid}`);
  }

  return concatBytes([Uint8Array.from(txid).reverse(), uint32LE(input.vout)]);
}

function serializeInput(input: TxInput): Uint8Array {
  return concatBytes([
    serializeOutpoint(input),
    bytesWithCompactSize(input.scriptSig),
    uint32LE(input.sequence),
  ]);
}

function serializeOutput(output: TxOutput): Uint8Array {
  return concatBytes([
    int64LE(output.valueZatoshis),
    bytesWithCompactSize(output.scriptPubKey),
  ]);
}

function serializeV5Transaction(params: {
  consensusBranchId: string;
  lockTime: number;
  expiryHeight: number;
  inputs: TxInput[];
  outputs: TxOutput[];
}): Uint8Array {
  return concatBytes([
    uint32LE(OVERWINTERED_VERSION_5),
    uint32LE(VERSION_GROUP_ID),
    branchIdLE(params.consensusBranchId),
    uint32LE(params.lockTime),
    uint32LE(params.expiryHeight),
    compactSize(params.inputs.length),
    ...params.inputs.map(serializeInput),
    compactSize(params.outputs.length),
    ...params.outputs.map(serializeOutput),
    compactSize(0), // nSpendsSapling
    compactSize(0), // nOutputsSapling
    compactSize(0), // nActionsOrchard
  ]);
}

function branchIdLE(branchIdHex: string): Uint8Array {
  const normalized = strip0x(branchIdHex).toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(normalized)) {
    throw new Error(
      `Consensus branch ID must be exactly 8 hex characters; got ${branchIdHex}`,
    );
  }

  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(Number.parseInt(normalized, 16), 0);
  return Uint8Array.from(buffer);
}

function headerDigest(params: {
  consensusBranchId: string;
  lockTime: number;
  expiryHeight: number;
}): Uint8Array {
  return blake2b256(
    "ZTxIdHeadersHash",
    concatBytes([
      uint32LE(OVERWINTERED_VERSION_5),
      uint32LE(VERSION_GROUP_ID),
      branchIdLE(params.consensusBranchId),
      uint32LE(params.lockTime),
      uint32LE(params.expiryHeight),
    ]),
  );
}

function transparentDigests(inputs: TxInput[], outputs: TxOutput[]) {
  const prevoutsDigest = blake2b256(
    "ZTxIdPrevoutHash",
    concatBytes(inputs.map(serializeOutpoint)),
  );
  const sequenceDigest = blake2b256(
    "ZTxIdSequencHash",
    concatBytes(inputs.map((input) => uint32LE(input.sequence))),
  );
  const outputsDigest = blake2b256(
    "ZTxIdOutputsHash",
    concatBytes(outputs.map(serializeOutput)),
  );
  const amountsDigest = blake2b256(
    "ZTxTrAmountsHash",
    concatBytes(inputs.map((input) => int64LE(input.valueZatoshis))),
  );
  const scriptPubKeysDigest = blake2b256(
    "ZTxTrScriptsHash",
    concatBytes(
      inputs.map((input) => bytesWithCompactSize(input.scriptPubKey)),
    ),
  );

  return {
    prevoutsDigest,
    sequenceDigest,
    outputsDigest,
    amountsDigest,
    scriptPubKeysDigest,
  };
}

function signatureDigest(params: {
  consensusBranchId: string;
  lockTime: number;
  expiryHeight: number;
  inputs: TxInput[];
  outputs: TxOutput[];
  inputIndex: number;
}): Uint8Array {
  const input = params.inputs[params.inputIndex];
  if (!input) {
    throw new Error(`Missing input at index ${params.inputIndex}`);
  }

  const digests = transparentDigests(params.inputs, params.outputs);
  const txInDigest = blake2b256(
    "Zcash___TxInHash",
    concatBytes([
      serializeOutpoint(input),
      int64LE(input.valueZatoshis),
      bytesWithCompactSize(input.scriptPubKey),
      uint32LE(input.sequence),
    ]),
  );
  const transparentSigDigest = blake2b256(
    "ZTxIdTranspaHash",
    concatBytes([
      uint8(SIGHASH_ALL),
      digests.prevoutsDigest,
      digests.amountsDigest,
      digests.scriptPubKeysDigest,
      digests.sequenceDigest,
      digests.outputsDigest,
      txInDigest,
    ]),
  );
  const personalization = concatBytes([
    ascii("ZcashTxHash_"),
    branchIdLE(params.consensusBranchId),
  ]);

  return blake2b256(
    personalization,
    concatBytes([
      headerDigest(params),
      transparentSigDigest,
      blake2b256("ZTxIdSaplingHash", new Uint8Array()),
      blake2b256("ZTxIdOrchardHash", new Uint8Array()),
    ]),
  );
}

function pushData(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 0x4c) {
    return concatBytes([uint8(bytes.length), bytes]);
  }

  if (bytes.length <= 0xff) {
    return concatBytes([Uint8Array.of(0x4c, bytes.length), bytes]);
  }

  throw new Error("Pushdata too large for this example");
}

function p2pkhScriptSig(
  derSignatureWithHashType: Uint8Array,
  publicKey: Uint8Array,
): Uint8Array {
  return concatBytes([pushData(derSignatureWithHashType), pushData(publicKey)]);
}

const SECP256K1_ORDER = BigInt(
  "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
);
const SECP256K1_ORDER_HALF = SECP256K1_ORDER >> 1n;

function toLowS(rHex: string, sHex: string): { r: string; s: string } {
  const r = BigInt(`0x${strip0x(rHex)}`);
  let s = BigInt(`0x${strip0x(sHex)}`);
  if (s > SECP256K1_ORDER_HALF) {
    s = SECP256K1_ORDER - s;
  }

  return {
    r: r.toString(16).padStart(64, "0"),
    s: s.toString(16).padStart(64, "0"),
  };
}

function derInteger(hex: string): Uint8Array {
  let bytes = fromHex(hex);
  while (bytes.length > 1 && bytes[0] === 0) {
    bytes = bytes.subarray(1);
  }

  if ((bytes[0] ?? 0) & 0x80) {
    bytes = concatBytes([Uint8Array.of(0x00), bytes]);
  }

  return concatBytes([Uint8Array.of(0x02, bytes.length), bytes]);
}

function rsToDer(rHex: string, sHex: string): Uint8Array {
  const r = derInteger(rHex);
  const s = derInteger(sHex);
  const body = concatBytes([r, s]);
  return concatBytes([Uint8Array.of(0x30, body.length), body]);
}

function zecToZatoshis(amount: unknown): bigint {
  if (typeof amount === "number") {
    return BigInt(Math.round(amount * 100_000_000));
  }

  if (typeof amount !== "string") {
    throw new Error(`Cannot convert amount ${amount} to zatoshis`);
  }

  const [whole, fractional = ""] = amount.split(".");
  if (whole === undefined) {
    throw new Error(`Cannot convert amount ${amount} to zatoshis`);
  }
  const frac = fractional.padEnd(8, "0").slice(0, 8);
  return BigInt(whole) * 100_000_000n + BigInt(frac || "0");
}

function parseUtxo(raw: any): Utxo {
  const value =
    raw.valueZatoshis ??
    raw.satoshis ??
    raw.value ??
    raw.amountZatoshis ??
    raw.amount;

  const valueZatoshis =
    typeof value === "number" || typeof value === "string"
      ? value.toString().includes(".")
        ? zecToZatoshis(value)
        : BigInt(value)
      : BigInt(value);

  const utxo: Utxo = {
    txid: String(raw.txid),
    vout: Number(raw.vout ?? raw.outputIndex),
    valueZatoshis,
  };

  if (raw.scriptPubKey) {
    utxo.scriptPubKey = fromHex(String(raw.scriptPubKey));
  } else if (raw.script) {
    utxo.scriptPubKey = fromHex(String(raw.script));
  }

  return utxo;
}

function parseUtxosJson(value: string): Utxo[] {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error("UTXOS_JSON must be a JSON array");
  }

  return parsed.map(parseUtxo);
}

async function getUtxos(rpc: ZcashRpc, address: string): Promise<Utxo[]> {
  if (process.env.UTXOS_JSON && !process.env.UTXOS_JSON.includes("<txid>")) {
    return parseUtxosJson(process.env.UTXOS_JSON);
  }

  try {
    const result = await rpc.call<any[]>("getaddressutxos", [
      { addresses: [address] },
    ]);
    return result.map(parseUtxo);
  } catch (error) {
    console.warn(
      `getaddressutxos unavailable; trying listunspent (${(error as Error).message})`,
    );
  }

  const result = await rpc.call<any[]>("listunspent", [0, 9999999, [address]]);
  return result.map(parseUtxo);
}

function selectUtxos(
  utxos: Utxo[],
  target: bigint,
): {
  selected: Utxo[];
  total: bigint;
} {
  const selected: Utxo[] = [];
  let total = 0n;

  for (const utxo of [...utxos].sort((a, b) =>
    a.valueZatoshis > b.valueZatoshis ? -1 : 1,
  )) {
    selected.push(utxo);
    total += utxo.valueZatoshis;
    if (total >= target) {
      return { selected, total };
    }
  }

  throw new Error(
    `Insufficient funds: need ${target} zatoshis, have ${total} zatoshis`,
  );
}

async function resolveConsensusBranchId(
  rpc: ZcashRpc,
): Promise<{ branchId: string; height: number }> {
  const info = await rpc.call<any>("getblockchaininfo");
  const envBranchId = process.env.CONSENSUS_BRANCH_ID;
  const branchId =
    !envBranchId || envBranchId.includes("<optional")
      ? (info?.consensus?.nextblock ?? info?.consensus?.chaintip)
      : envBranchId;

  if (!branchId) {
    throw new Error(
      "Could not infer consensus branch ID from getblockchaininfo; set CONSENSUS_BRANCH_ID in .env.local",
    );
  }

  return {
    branchId: strip0x(String(branchId)),
    height: Number(info.blocks),
  };
}

async function turnkeySignDigest(
  client: ReturnType<TurnkeyServerSDK["apiClient"]>,
  signWith: string,
  digest: Uint8Array,
): Promise<Uint8Array> {
  const response: any = await client.signRawPayload({
    signWith,
    payload: bytesToHex(digest),
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NO_OP",
  });

  const sig =
    response?.activity?.result?.signRawPayloadResult ??
    response?.result?.signRawPayloadResult ??
    response;

  if (!sig?.r || !sig?.s) {
    throw new Error(
      `Turnkey response is missing r/s: ${JSON.stringify(response)}`,
    );
  }

  const { r, s } = toLowS(sig.r, sig.s);
  return rsToDer(r, s);
}

function assertValueRange(value: bigint, label: string) {
  if (value <= 0n || value > MAX_MONEY_ZATOSHIS) {
    throw new Error(`${label} must be between 1 and MAX_MONEY zatoshis`);
  }
}

async function main() {
  const network = normalizeNetwork(process.env.ZCASH_NETWORK);
  const signWith = requiredEnv("SIGN_WITH");
  const publicKeyHex =
    process.env.SIGNER_COMPRESSED_PUBLIC_KEY &&
    !process.env.SIGNER_COMPRESSED_PUBLIC_KEY.includes("<33-byte")
      ? process.env.SIGNER_COMPRESSED_PUBLIC_KEY
      : signWith;
  const publicKey = validateCompressedPublicKey(publicKeyHex);
  const sourceAddress =
    process.env.SOURCE_TADDRESS &&
    !process.env.SOURCE_TADDRESS.includes("<optional")
      ? process.env.SOURCE_TADDRESS
      : deriveP2pkhAddress(publicKey, network);
  const changeAddress =
    process.env.CHANGE_TADDRESS &&
    !process.env.CHANGE_TADDRESS.includes("<optional")
      ? process.env.CHANGE_TADDRESS
      : sourceAddress;
  const destinationAddress = requiredEnv("DESTINATION_TADDRESS");
  const sendAmount = BigInt(requiredEnv("SEND_AMOUNT_ZATOSHIS"));
  const fee = BigInt(requiredEnv("FEE_ZATOSHIS"));

  assertValueRange(sendAmount, "SEND_AMOUNT_ZATOSHIS");
  assertValueRange(fee, "FEE_ZATOSHIS");

  if (!isCompressedPublicKeyHex(publicKeyHex)) {
    throw new Error("Invalid compressed public key");
  }

  const expectedSourceScript = p2pkhScriptForTransparentAddress(
    sourceAddress,
    network,
  );
  const rpc = new ZcashRpc(
    requiredEnv("ZCASH_RPC_URL"),
    optionalEnv("ZCASH_RPC_USERNAME"),
    optionalEnv("ZCASH_RPC_PASSWORD"),
  );
  const { branchId, height } = await resolveConsensusBranchId(rpc);
  const expiryDelta = Number(process.env.EXPIRY_DELTA ?? "20");
  const expiryHeight = height + expiryDelta;

  const utxos = await getUtxos(rpc, sourceAddress);
  if (utxos.length === 0) {
    throw new Error(`No UTXOs found for ${sourceAddress}`);
  }

  const need = sendAmount + fee;
  const { selected, total } = selectUtxos(utxos, need);
  const change = total - need;

  const inputs: TxInput[] = selected.map((utxo) => {
    const scriptPubKey = utxo.scriptPubKey ?? expectedSourceScript;
    if (bytesToHex(scriptPubKey) !== bytesToHex(expectedSourceScript)) {
      throw new Error(
        `UTXO ${utxo.txid}:${utxo.vout} is not a P2PKH output for ${sourceAddress}`,
      );
    }

    return {
      txid: utxo.txid,
      vout: utxo.vout,
      valueZatoshis: utxo.valueZatoshis,
      scriptPubKey,
      sequence: FINAL_SEQUENCE,
      scriptSig: new Uint8Array(),
    };
  });
  const outputs: TxOutput[] = [
    {
      valueZatoshis: sendAmount,
      scriptPubKey: scriptForTransparentAddress(destinationAddress, network),
    },
  ];

  if (change > 0n) {
    outputs.push({
      valueZatoshis: change,
      scriptPubKey: scriptForTransparentAddress(changeAddress, network),
    });
  }

  const turnkey = new TurnkeyServerSDK({
    apiBaseUrl: requiredEnv("BASE_URL"),
    apiPrivateKey: requiredEnv("API_PRIVATE_KEY"),
    apiPublicKey: requiredEnv("API_PUBLIC_KEY"),
    defaultOrganizationId: requiredEnv("ORGANIZATION_ID"),
  });
  const apiClient = turnkey.apiClient();

  console.log(`Network: zcash ${network}`);
  console.log(`Consensus branch ID: ${branchId}`);
  console.log(`Source t-address: ${sourceAddress}`);
  console.log(`Destination: ${destinationAddress}`);
  console.log(`Inputs: ${selected.length}, total: ${total} zatoshis`);
  console.log(
    `Send: ${sendAmount} zatoshis, fee: ${fee} zatoshis, change: ${change} zatoshis`,
  );

  for (let i = 0; i < inputs.length; i++) {
    const digest = signatureDigest({
      consensusBranchId: branchId,
      lockTime: 0,
      expiryHeight,
      inputs,
      outputs,
      inputIndex: i,
    });
    const derSignature = await turnkeySignDigest(apiClient, signWith, digest);
    inputs[i]!.scriptSig = p2pkhScriptSig(
      concatBytes([derSignature, uint8(SIGHASH_ALL)]),
      publicKey,
    );
  }

  const signedTx = serializeV5Transaction({
    consensusBranchId: branchId,
    lockTime: 0,
    expiryHeight,
    inputs,
    outputs,
  });
  const signedTxHex = bytesToHex(signedTx);

  console.log("Signed Zcash transaction hex:");
  console.log(signedTxHex);
  console.log(`Bytes: ${signedTx.length}`);

  if (process.env.BROADCAST === "true") {
    const txid = await rpc.call<string>("sendrawtransaction", [signedTxHex]);
    console.log(`Broadcasted txid: ${txid}`);
  } else {
    console.log(
      "Dry run only. Set BROADCAST=true to submit via ZCASH_RPC_URL.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
