import { base64urlEncode } from "./encoding";
import { P256Generator } from "./p256";
import {crypto, JsonWebKey,CryptoKey} from './crypto'
// Key material utilities

//exported
export const generateTargetKey = async (): Promise<any> => {
  const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
  );
  return crypto.subtle.exportKey("jwk", keyPair.privateKey);
};

export const importCredential = async (
  privateKeyBytes: Uint8Array
): Promise<any> => {
  var privateKeyHexString = uint8arrayToHexString(privateKeyBytes);
  var privateKey = BigInt("0x" + privateKeyHexString);
  var publicKeyPoint = P256Generator.multiply(privateKey);

  return await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: bigIntToBase64Url(privateKey),
      x: bigIntToBase64Url(publicKeyPoint.x.num),
      y: bigIntToBase64Url(publicKeyPoint.y.num),
      ext: true,
    },
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign"]
  );
};

export const p256JWKPrivateToPublic = async (privateJwk: JsonWebKey): Promise<Uint8Array> => {
  const publicKey = await crypto.subtle.importKey(
      'jwk',
      privateJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
  );
  const rawPublicKey = await crypto.subtle.exportKey('raw', publicKey as CryptoKey);
  return new Uint8Array(rawPublicKey);
};

export const compressRawPublicKey = (rawPublicKey: Uint8Array): Uint8Array => {
  const len = rawPublicKey.byteLength;

  // Drop the y coordinate
  // Uncompressed key is in the form 0x04||x||y
  // `len >>> 1` is a more concise way to write `floor(len/2)`
  var compressedBytes = rawPublicKey.slice(0, (1 + len) >>> 1);

  // Encode the parity of `y` in first bit
  // `BYTE & 0x01` tests for parity and returns 0x00 when even, or 0x01 when odd
  // Then `0x02 | <parity test result>` yields either 0x02 (even case) or 0x03 (odd).
  compressedBytes[0] = 0x02 | (rawPublicKey[len - 1]! & 0x01);
  return compressedBytes;
};

export const uncompressRawPublicKey = (
  rawPublicKey: Uint8Array
): Uint8Array => {
  if (rawPublicKey[0] !== 0x02 && rawPublicKey[0] !== 0x03) {
    throw new Error("Invalid public key format");
  }

  const lsb = rawPublicKey[0] === 0x03;
  const x = BigInt("0x" + uint8arrayToHexString(rawPublicKey.subarray(1)));

  // https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf (Appendix D).
  const p = BigInt(
    "115792089210356248762697446949407573530086143415290314195533631308867097853951"
  );
  const b = BigInt(
    "0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"
  );
  const a = p - BigInt(3);
  const rhs = ((x * x + a) * x + b) % p;
  let y = modSqrt(rhs, p);
  if (lsb !== testBit(y, 0)) {
    y = (p - y) % p;
  }

  if (x < BigInt(0) || x >= p) {
    throw new Error("x is out of range");
  }

  if (y < BigInt(0) || y >= p) {
    throw new Error("y is out of range");
  }

  var uncompressedHexString = "04" + bigIntToHex(x) + bigIntToHex(y);
  return uint8arrayFromHexString(uncompressedHexString);
};
export const convertEcdsaIeee1363ToDer = (ieee: Uint8Array): Uint8Array => {
  if (ieee.length % 2 !== 0 || ieee.length === 0 || ieee.length > 132) {
    throw new Error(
      "Invalid IEEE P1363 signature encoding. Length: " + ieee.length
    );
  }

  const r = toUnsignedBigNum(ieee.subarray(0, ieee.length / 2));
  const s = toUnsignedBigNum(ieee.subarray(ieee.length / 2));

  let offset = 0;
  const length = 1 + 1 + r.length + 1 + 1 + s.length;
  let der: Uint8Array;

  if (length >= 128) {
    der = new Uint8Array(length + 3);
    der[offset++] = 48;
    der[offset++] = 128 + 1;
    der[offset++] = length;
  } else {
    der = new Uint8Array(length + 2);
    der[offset++] = 48;
    der[offset++] = length;
  }

  der[offset++] = 2;
  der[offset++] = r.length;
  der.set(r, offset);
  offset += r.length;

  der[offset++] = 2;
  der[offset++] = s.length;
  der.set(s, offset);

  return der;
};

export const hpkeDecrypt = async ({
  ciphertextBuf,
  encappedKeyBuf,
  receiverPrivJwk,
}: {
  ciphertextBuf: ArrayBuffer;
  encappedKeyBuf: ArrayBuffer;
  receiverPrivJwk: JsonWebKey;
}): Promise<Uint8Array> => {
  try {
    // Import the receiver's private key for ECDH
    const receiverPrivKey = await crypto.subtle.importKey(
      "jwk",
      receiverPrivJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false, 
      ["deriveKey"]
    );

    const receiverPubBuf = await p256JWKPrivateToPublic(receiverPrivJwk);

    // Compute AAD
    const aad = additionalAssociatedData(encappedKeyBuf, receiverPubBuf);

      const encappedKeyUint = new Uint8Array(encappedKeyBuf)
    // Import the encapsulated public key
    const publicCryptoKey = await crypto.subtle.importKey(
      "raw",
      encappedKeyUint,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );

    // Derive the shared secret
    const sharedSecret = await crypto.subtle.deriveKey(
      { name: "ECDH", public: publicCryptoKey as CryptoKey},
      receiverPrivKey as CryptoKey,
      { name: "HKDF" }, 
      false,
      ["encrypt", "decrypt"]
    );

    // Convert shared secret to a usable format
    const sharedSecretKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(await crypto.subtle.exportKey("raw", sharedSecret)),
      { name: "HKDF" }, 
      false,
      ["deriveKey"]
    );
    
    // Derive the AES-GCM key from the shared secret using HKDF
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        public: publicCryptoKey as CryptoKey
      },
      sharedSecretKey as CryptoKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // Decrypt the ciphertext
    const ciphertextUint = new Uint8Array(ciphertextBuf)
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(12), 
        tagLength: 128
      },
      aesKey,
      ciphertextUint,
      aad
    );

    return new Uint8Array(decryptedData);
  } catch (e) {
    console.error("Decryption failed:", e);
    throw new Error("Decryption failed: " + e);
  }
};

// internal
const testBit = (n: bigint, i: number) => {
  const m = BigInt(1) << BigInt(i);
  return (n & m) !== BigInt(0);
};

const toUnsignedBigNum = (bytes: Uint8Array): Uint8Array => {
  let start = 0;
  while (start < bytes.length && bytes[start] === 0) {
    start++;
  }

  if (bytes[start]! & 0x80) {
    const result = new Uint8Array(bytes.length - start + 1);
    result.set(bytes.subarray(start), 1);
    return result;
  } else {
    return bytes.subarray(start);
  }
};
const uint8arrayToHexString = (array: Uint8Array): string => {
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
};

const uint8arrayFromHexString = (hexString: string): Uint8Array => {
  return new Uint8Array(
    hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
};

const bigIntToBase64Url = (num: bigint) => {
  var hexString = num.toString(16);
  // Add an extra 0 to the start of the string to get a valid hex string (even length)
  // (e.g. 0x0123 instead of 0x123)
  var hexString = hexString.padStart(Math.ceil(hexString.length / 2) * 2, "0");
  var buffer = uint8arrayFromHexString(hexString);
  return base64urlEncode(buffer);
};

const bigIntToHex = (num: bigint): string => {
  return num.toString(16);
};

const additionalAssociatedData = (
  senderPubBuf: ArrayBuffer,
  receiverPubBuf: ArrayBuffer
): Uint8Array => {
  var s = Array.from(new Uint8Array(senderPubBuf));
  var r = Array.from(new Uint8Array(receiverPubBuf));
  return new Uint8Array([...s, ...r]);
};

const modSqrt = (x: bigint, p: bigint): bigint => {
  if (p <= BigInt(0)) {
    throw new Error("p must be positive");
  }
  var base = x % p;
  if ((p & BigInt(3)) === BigInt(3)) {
    const q = (p + BigInt(1)) >> BigInt(2);
    let result = base;
    let exp = q;
    while (exp > BigInt(0)) {
      if (exp & BigInt(1)) {
        result = (result * base) % p;
      }
      base = (base * base) % p;
      exp >>= BigInt(1);
    }
    return result;
  }
  throw new Error("unsupported modulus value");
};


