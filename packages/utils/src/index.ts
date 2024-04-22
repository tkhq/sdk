import * as hpke from '@hpke/core';
import { subtle, webcrypto} from 'crypto';


// Exported Utilities

export const generateTargetKey = async (): Promise<webcrypto.JsonWebKey> => {
    const keyPair = await subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
    );
    return subtle.exportKey("jwk", keyPair.privateKey);
};

export const importCredential = async (privateKeyBytes: Uint8Array): Promise<webcrypto.CryptoKey> => {
    const privateKey = await subtle.importKey(
        'raw',
        privateKeyBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']
    );
    return privateKey;
};

export const p256JWKPrivateToPublic = async (privateJwk: webcrypto.JsonWebKey): Promise<Uint8Array> => {
    const publicKey = await subtle.importKey(
        'jwk',
        privateJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
    );
    const rawPublicKey = await subtle.exportKey('raw', publicKey);
    return new Uint8Array(rawPublicKey);
};

export const compressRawPublicKey = (rawPublicKey: Uint8Array): Uint8Array => {
    const len = rawPublicKey.byteLength;
    const compressed = new Uint8Array(1 + len / 2);
    compressed.set([2 + (rawPublicKey[len - 1]! % 2)], 0);
    compressed.set(rawPublicKey.slice(1, 1 + len / 2), 1);
    return compressed;
};

export const uncompressRawPublicKey =(rawPublicKey: Uint8Array): Uint8Array => {
    if (rawPublicKey[0] !== 0x02 && rawPublicKey[0] !== 0x03) {
        throw new Error("Invalid public key format");
    }

    const lsb = rawPublicKey[0] === 0x03;
    const x = BigInt("0x" + uint8arrayToHexString(rawPublicKey.subarray(1)));

    // https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf (Appendix D).
    const p = BigInt("115792089210356248762697446949407573530086143415290314195533631308867097853951");
    const b = BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b");
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
        return uint8arrayFromHexString(uncompressedHexString)
}
export const convertEcdsaIeee1363ToDer = (ieee: Uint8Array): Uint8Array => {
    if (ieee.length % 2 !== 0 || ieee.length === 0 || ieee.length > 132) {
        throw new Error("Invalid IEEE P1363 signature encoding. Length: " + ieee.length);
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
}

export const modSqrt = (a: bigint, p: bigint): bigint => {
    if (p <= BigInt(0)) {
        throw new Error("p must be positive");
    }

    const base = a % p;
    if (testBit(p, 0) && testBit(p, 1)) {
        const q = (p + BigInt(1)) >> BigInt(2);
        const squareRoot = modPow(base, q, p);
        if ((squareRoot * squareRoot) % p !== base) {
            throw new Error("could not find a modular square root");
        }
        return squareRoot;
    }

    throw new Error("unsupported modulus value");

    function testBit(n: bigint, i: number): boolean {
        const mask = BigInt(1) << BigInt(i);
        return (n & mask) !== BigInt(0);
    }

    function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
        let result = BigInt(1);
        let b = base % modulus;

        while (exponent > 0) {
            if (exponent % BigInt(2) === BigInt(1)) {
                result = (result * b) % modulus;
            }
            exponent = exponent >> BigInt(1);
            b = (b * b) % modulus;
        }

        return result;
    }
};

export const base64urlEncode = (data: Uint8Array): string => {
    let binary = '';
    data.forEach((byte) => binary += String.fromCharCode(byte));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const base64urlDecode = (base64url: string): Uint8Array => {
    let binary_string = atob(base64url.replace(/\-/g, '+').replace(/_/g, '/'));
    let len = binary_string.length;
    let bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++)        {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
};

export const base58checkDecode = (input: string): Uint8Array => {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const ALPHABET_MAP = new Map([...ALPHABET].map((char, index) => [char, index]));

    if (input.length === 0) return new Uint8Array();

    let bytes = [0];
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (!ALPHABET_MAP.has(char!)) {
            throw new Error('Invalid character found: ' + char);
        }
        const value = ALPHABET_MAP.get(char!)!;

        for (let j = 0; j < bytes.length; j++) {
            bytes[j] *= 58;
        }
        bytes[0] += value;

        let carry = 0;
        for (let j = 0; j < bytes.length; j++) {
            bytes[j] += carry;
            carry = (bytes[j]! >> 8);
            bytes[j] &= 0xff;
        }

        while (carry > 0) {
            bytes.push(carry & 0xff);
            carry >>= 8;
        }
    }

    // Reverse bytes array
    bytes.reverse();

    // Remove leading zeros
    const zeroCount = input.split('').findIndex(char => char !== '1');
    const leadingZeros = Array(zeroCount).fill(0);
    bytes = [...leadingZeros, ...bytes];

    // Verify checksum
    const payload = bytes.slice(0, -4);
    const checksum = bytes.slice(-4);
    const expectedChecksum = doubleSha256(payload).slice(0, 4);

    if (!checksum.every((byte, index) => byte === expectedChecksum[index])) {
        throw new Error('Invalid checksum');
    }

    return new Uint8Array(payload);
};

export const hpkeDecrypt = async ({
    ciphertextBuf,
    encappedKeyBuf,
    receiverPrivJwk,
}: {
    ciphertextBuf: ArrayBuffer,
    encappedKeyBuf: ArrayBuffer,
    receiverPrivJwk: webcrypto.JsonWebKey,
}): Promise<ArrayBuffer> => {
    const kemContext = new hpke.DhkemP256HkdfSha256();
    const receiverPriv = await kemContext.importKey("jwk", { ...receiverPrivJwk }, false);

    const suite = new hpke.CipherSuite({
        kem: kemContext,
        kdf: new hpke.HkdfSha256(),
        aead: new hpke.Aes256Gcm(),
    });

    const recipientCtx = await suite.createRecipientContext({
        recipientKey: receiverPriv,
        enc: encappedKeyBuf,
        info: new TextEncoder().encode("turnkey_hpke"),
    });

    const receiverPubBuf = await p256JWKPrivateToPublic(receiverPrivJwk);
    const aad = additionalAssociatedData(encappedKeyBuf, receiverPubBuf);
    
    try {
        return await recipientCtx.open(ciphertextBuf, aad);
    } catch (e) {
        if (e instanceof Error) {
            throw new Error("HPKE decryption failed: " + e.message);
        } else {
            throw new Error("HPKE decryption failed and an unknown error was thrown");
        }
    }
};


// Internal functions
const testBit = (n:bigint, i:number) => {
  const m = BigInt(1) << BigInt(i);
  return (n & m) !== BigInt(0);
}

const toUnsignedBigNum =(bytes: Uint8Array): Uint8Array => {
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
}
const uint8arrayToHexString = (array: Uint8Array): string => {
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

const uint8arrayFromHexString = (hexString: string): Uint8Array => {
    return new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
};


const doubleSha256= (input: number[]): Uint8Array => {
    const crypto = require('crypto');
    const hash1 = crypto.createHash('sha256').update(new Uint8Array(input)).digest();
    return crypto.createHash('sha256').update(hash1).digest();
}


const bigIntToHex = (num: bigint): string => {
    return num.toString(16);
};

const additionalAssociatedData = (encappedKeyBuf: ArrayBuffer, receiverPubBuf: ArrayBuffer): Uint8Array => {
    return new Uint8Array([...new Uint8Array(encappedKeyBuf), ...new Uint8Array(receiverPubBuf)]);
};

