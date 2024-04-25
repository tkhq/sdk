import * as hpke from '@hpke/core';
import { subtle, webcrypto} from 'crypto';
import { base64urlEncode } from './encoding';
import { P256Generator } from './p256';


// Key material utilities

//exported
export const generateTargetKey = async (): Promise<webcrypto.JsonWebKey> => {
    const keyPair = await subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
    );
    return subtle.exportKey("jwk", keyPair.privateKey);
};

export const importCredential = async (privateKeyBytes: Uint8Array): Promise<webcrypto.CryptoKey> => {
        var privateKeyHexString = uint8arrayToHexString(privateKeyBytes);
        var privateKey = BigInt('0x' + privateKeyHexString);
        var publicKeyPoint = P256Generator.multiply(privateKey);

        return await subtle.importKey(
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
        )
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

export const hpkeEncrypt = async ({
    plaintextBuf,
    recipientPubJwk,
}: {
    plaintextBuf: ArrayBuffer,
    recipientPubJwk: webcrypto.JsonWebKey,
}): Promise<{ ciphertextBuf: ArrayBuffer, encappedKeyBuf: ArrayBuffer }> => {
    const kemContext = new hpke.DhkemP256HkdfSha256();
    const recipientPub = await kemContext.importKey("jwk", recipientPubJwk, true);

    const suite = new hpke.CipherSuite({
        kem: kemContext,
        kdf: new hpke.HkdfSha256(),
        aead: new hpke.Aes256Gcm(),
    });

    const senderCtx = await suite.createSenderContext({
        recipientPublicKey: recipientPub,
        info: new TextEncoder().encode("turnkey_hpke"),
    });

    const ciphertextBuf = await senderCtx.seal(plaintextBuf);
    const encappedKeyBuf = senderCtx.enc;

    return { ciphertextBuf, encappedKeyBuf };
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


// internal
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


const bigIntToBase64Url = (num:bigint) => {
    var hexString = num.toString(16);
    // Add an extra 0 to the start of the string to get a valid hex string (even length)
    // (e.g. 0x0123 instead of 0x123)
    var hexString = hexString.padStart(Math.ceil(hexString.length/2)*2, '0')
    var buffer = uint8arrayFromHexString(hexString);
    return base64urlEncode(buffer)
}

const bigIntToHex = (num: bigint): string => {
    return num.toString(16);
};

const additionalAssociatedData = (encappedKeyBuf: ArrayBuffer, receiverPubBuf: ArrayBuffer): Uint8Array => {
    return new Uint8Array([...new Uint8Array(encappedKeyBuf), ...new Uint8Array(receiverPubBuf)]);
};


      
const modSqrt = (a: bigint, p: bigint): bigint => {
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