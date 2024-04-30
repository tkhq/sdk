// import { NativeModules } from 'react-native';

// // from https://github.com/ghostery/user-agent-ios/blob/develop/ReactNative/js/globals/window/crypto.ts

// export interface JsonWebKey {
//   alg?: string;
//   crv?: string;
//   d?: string;
//   dp?: string;
//   dq?: string;
//   e?: string;
//   ext?: boolean;
//   k?: string;
//   key_ops?: string[];
//   kty?: string;
//   n?: string;
//   p?: string;
//   q?: string;
//   qi?: string;
//   use?: string;
//   x?: string;
//   y?: string;
// }

// const toHexString = (bytes: Uint8Array) =>
//   bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

// function arrayBufferToHexString(buffer: ArrayBuffer) {
//   return toHexString(new Uint8Array(buffer));
// }

// function hexStringToByteArray(hexString: string): ArrayBuffer {
//   const typedArray = new Uint8Array(
//     (hexString.match(/[\da-f]{2}/gi) || []).map((h: string) => {
//       return parseInt(h, 16);
//     }),
//   );
//   return typedArray.buffer;
// }

// function toByteArray(data: any) {
//   if (data.buffer) {
//     return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
//   }
//   return new Uint8Array(data);
// }

// class RandomPool {
//   pool: number[] = [];

//   pending: number = 0;

//   addEntropy(entropy: ArrayBuffer) {
//     const buffer = new Uint8Array(entropy);
//     Array.prototype.forEach.call(buffer, x => {
//       this.pool.push(x);
//     });
//     this.pending -= buffer.length;
//     if (this.pending < 0) {
//       throw new Error('Something went wrong');
//     }
//   }

//   getRandomByte(): number {
//     const randomByte = this.pool.shift();
//     if (this.pool.length + this.pending < 1024 * 48) {
//       this.fetchEntropy(1024 * 64);
//     }

//     if (typeof randomByte === 'undefined') {
//       throw new Error("We've run out of entropy, sorry.");
//     }

//     return randomByte;
//   }

//   async fetchEntropy(size: number) {
//     this.pending += size;
//     const randomString = await NativeModules.WindowCrypto.generateEntropy(size);
//     const randomBuffer = hexStringToByteArray(randomString);
//     this.addEntropy(randomBuffer);
//   }
// }

// const randomPool = new RandomPool();

// export interface CryptoKey {
//   extractable: boolean;
//   type?: 'public' | 'private';
//   usages: string[];
//   id: number;
// }

// interface Algorithm {
//   name: string;
//   namedCurve?: string;
//   public?: CryptoKey;
//   length?: number;
//   iv?: TypedArray;
//   tagLength?: number;
// }

// type TypedArray = ArrayBuffer | Uint8Array | Uint16Array | Uint32Array;
// export const crypto = {
//   getRandomValues(a: TypedArray) {
//     const view = toByteArray(a);
//     const len = view.length;

//     if (len > 65536) {
//       throw new Error('crypto.getRandomValues: Quota exceeded');
//     }

//     // const rnd = forge.random.getBytesSync(len);
//     for (let i = 0; i < len; i += 1) {
//       const x = randomPool.getRandomByte();
//       view[i] = x;
//     }
//     return a;
//   },
//   subtle: {
//     async digest(
//       algorithm: string | { name: string },
//       data: ArrayBuffer,
//     ): Promise<ArrayBuffer> {
//       const algorithmName =
//         typeof algorithm === 'string' ? algorithm : algorithm.name;
//       const serializedData = arrayBufferToHexString(data);

//       const hexHash = await NativeModules.WindowCrypto.digest(
//         algorithmName,
//         serializedData,
//       );
//       return hexStringToByteArray(hexHash);
//     },
//     async generateKey(
//       algorithm: Algorithm,
//       extractable: boolean,
//       keyUsages: string[],
//     ): Promise<{
//       privateKey: CryptoKey;
//       publicKey: CryptoKey;
//     }> {
//       const { name, namedCurve } = algorithm;
//       if (name !== 'ECDH' || namedCurve !== 'P-256') {
//         throw new Error(
//           'crypto.subtle.generateKey - unsuported algorithm type',
//         );
//       }
//       const {
//         privateKeyId,
//         publicKeyId,
//       } = await NativeModules.WindowCrypto.generateKey();

//       return {
//         publicKey: {
//           extractable,
//           type: 'public',
//           usages: keyUsages,
//           id: publicKeyId,
//         },
//         privateKey: {
//           extractable,
//           type: 'private',
//           usages: keyUsages,
//           id: privateKeyId,
//         },
//       };
//     },
//     async exportKey(format: string, key: CryptoKey): Promise<ArrayBuffer> {
//       let rawKey = await NativeModules.WindowCrypto.exportKey(key.id);
//       if (key.type === 'public') {
//         // crypto.subtle expects the type of the representation (0x04 == non-compressed) in the first byte
//         // (for details, refer to the remarks in deriveKey)
//         rawKey = `04${rawKey}`;
//       }
//       return hexStringToByteArray(rawKey);
//     },
//     async importKey(
//         format: string,
//         keyData: JsonWebKey | Uint8Array,
//         algorithm: Algorithm,
//         extractable: boolean,
//         usages: string[]
//       ): Promise<CryptoKey | void> {
//         let id;
      
//         if (keyData instanceof Uint8Array) {
//           // Convert Uint8Array to hex string if raw data is provided
//           const hexString = toHexString(keyData);
//           id = await NativeModules.WindowCrypto.importKey(hexString);
//         } else if (typeof keyData === 'object' && keyData.kty) {
//           // Assume keyData is a JsonWebKey if it's an object with a 'kty' property
//           const jwkString = JSON.stringify(keyData); // Convert JWK to a string
//           id = await NativeModules.WindowCrypto.importKey(jwkString);
//         } else {
//           throw new Error('Unsupported key data type for importKey');
//         }
//         return {
//             extractable,
//             usages,
//             id,
//           };
//     },
//     async deriveKey(
//       algorithm: Algorithm,
//       baseKey: CryptoKey,
//       derivedKeyAlgorithm: Algorithm,
//       extractable: boolean,
//       keyUsages: string[],
//     ): Promise<CryptoKey> {
//       if (!algorithm.public) {
//         throw new Error('new key');
//       }
//       const privateKeyHexString = await NativeModules.WindowCrypto.exportKey(
//         baseKey.id,
//       );
//       let publicKeyHexString = await NativeModules.WindowCrypto.exportKey(
//         algorithm.public.id,
//       );
//       // removing leading "04" which is type information
//       // (background: In crypto.subtle, P-256 curve points are represented as 65 bytes:
//       // the type (0x04 == non-compressed representation), and a pair of (x,y) coordinates (each 32 bytes).
//       // In the native API (cryptokit), the type is implicitly non-compressed; instead it only expect the (x,y) coordinates.
//       // See also: https://tools.ietf.org/id/draft-jivsov-ecc-compact-05.html#rfc.section.3 )
//       if (publicKeyHexString.length === 130) {
//         publicKeyHexString = publicKeyHexString.slice(2);
//       }
//       const id = await NativeModules.WindowCrypto.deriveKey(
//         privateKeyHexString,
//         publicKeyHexString,
//       );
//       return {
//         extractable,
//         usages: keyUsages,
//         id,
//       };
//     },
//     async encrypt(
//       algorithm: Algorithm,
//       key: CryptoKey,
//       data: Uint8Array,
//     ): Promise<ArrayBuffer> {
//       if (!algorithm.iv) {
//         throw new Error('No iv');
//       }
//       const dataHexString = toHexString(data);
//       const ivHexString = arrayBufferToHexString(algorithm.iv);
//       const encryptedDataHexString = await NativeModules.WindowCrypto.encrypt(
//         key.id,
//         ivHexString,
//         dataHexString,
//       );
//       return hexStringToByteArray(encryptedDataHexString);
//     },
//     async decrypt(
//       algorithm: Algorithm,
//       key: CryptoKey,
//       data: Uint8Array,
//     ): Promise<ArrayBuffer> {
//       if (!algorithm.iv) {
//         throw new Error('No iv');
//       }
//       // crypto.subtle represents the results of AES-GCM-128 as one array, while cryptokit expects
//       // ciphertext and tag to come as separate arguments. crypto.subtle will put the tag at the end,
//       // so we can split it of. The tag is 128 bits long, which is 16 bytes, or 32 bytes in hex-representation.
//       const hexString = toHexString(data);
//       const dataHexString = hexString.slice(0, -32);
//       const tagHexString = hexString.slice(-32);
//       const ivHexString = arrayBufferToHexString(algorithm.iv);
//       const encryptedDataHexString = await NativeModules.WindowCrypto.decrypt(
//         key.id,
//         ivHexString,
//         tagHexString,
//         dataHexString,
//       );
//       return hexStringToByteArray(encryptedDataHexString);
//     },
//   },
// };

// //
// // Testing code
// //
// // (async function test() {
// //   async function sha256(data) {
// //     return new Uint8Array(
// //       await crypto.subtle.digest({ name: 'SHA-256' }, data),
// //     );
// //   }

// //   function toUtf8(text) {
// //     return new TextEncoder().encode(text);
// //   }

// //   function fromUtf8(buffer) {
// //     return new TextDecoder().decode(buffer);
// //   }

// //   const {
// //     publicKey: bobPublic,
// //     privateKey: bobPrivate,
// //   } = await crypto.subtle.generateKey(
// //     { name: 'ECDH', namedCurve: 'P-256' },
// //     true,
// //     ['deriveKey'],
// //   );
// //   const {
// //     publicKey: alicePublic,
// //     privateKey: alicePrivate,
// //   } = await crypto.subtle.generateKey(
// //     { name: 'ECDH', namedCurve: 'P-256' },
// //     true,
// //     ['deriveKey'],
// //   );
// //   const bobPublicRaw = await crypto.subtle.exportKey('raw', bobPublic);
// //   const bobPublicArray = new Uint8Array(bobPublicRaw);
// //   const alicePrivateRaw = await crypto.subtle.exportKey('raw', alicePrivate);
// //   const alicePrivateArray = new Uint8Array(alicePrivateRaw);

// //   // testing import and export
// //   {
// //     const bobPublicCopy = await crypto.subtle.importKey(
// //       'raw',
// //       bobPublicArray,
// //       { name: 'ECDH', namedCurve: 'P-256' },
// //       false,
// //       [],
// //     );
// //     const bobPublicCopyRaw = await crypto.subtle.exportKey(
// //       'raw',
// //       bobPublicCopy,
// //     );
// //     const bobPublicCopyArray = new Uint8Array(bobPublicCopyRaw);
// //   }

// //   const aliceDerivedKey = await crypto.subtle.deriveKey(
// //     { name: 'ECDH', namedCurve: 'P-256', public: bobPublic },
// //     alicePrivate,
// //     { name: 'AES-GCM', length: 256 },
// //     true,
// //     ['encrypt', 'decrypt'],
// //   );
// //   const aliceDerivedKeyRaw = await crypto.subtle.exportKey(
// //     'raw',
// //     aliceDerivedKey,
// //   );
// //   const aliceDerivedKeyArray = new Uint8Array(aliceDerivedKeyRaw);

// //   const raw128bitKey = (await sha256(aliceDerivedKeyArray)).subarray(0, 16);
// //   console.warn("RAW", raw128bitKey.length, raw128bitKey);
// //   const secret = await crypto.subtle.importKey(
// //     'raw',
// //     raw128bitKey,
// //     { name: 'AES-GCM', length: 128 },
// //     false,
// //     ['encrypt', 'decrypt'],
// //   );
// //   const iv = crypto.getRandomValues(new Uint8Array(12));
// //   const ciphertext = await crypto.subtle.encrypt(
// //     { name: 'AES-GCM', iv, tagLength: 128 },
// //     secret,
// //     toUtf8('hello world'),
// //   );
// //   const ciphertextArray = new Uint8Array(ciphertext);
// //   const decrypted = fromUtf8(
// //     await crypto.subtle.decrypt(
// //       { name: 'AES-GCM', iv, tagLength: 128 },
// //       secret,
// //       ciphertextArray,
// //     ),
// //   );
// //   console.warn('decrypted', decrypted);
// // })();

// export const seedRandom = async () => {
//   return randomPool.fetchEntropy(1024 * 64);
// };