// import { NativeModules } from 'react-native';
// const { RNECC } = NativeModules;

// export type KeyPair = {
//   publicKey: string;
//   privateKey: string;
// }

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

// export interface JwkKeyData {
//   kty: string | undefined;
//   crv: string | undefined;
//   d?: string;
//   x?: string;
//   y?: string;
//   ext: boolean | undefined;
// }

// export const subtle = {
//   async generateKey(
//     { namedCurve }: { namedCurve: string },
//     exportable: boolean,
//     keyUsages: string[]
//   ): Promise<KeyPair> {
//     if (!['P-256', 'P-384', 'P-224', 'P-192'].includes(namedCurve)) {
//       throw new Error('Unsupported key generation algorithm');
//     }

//     return new Promise((resolve, reject) => {
//       RNECC.generateKeys({ curve: namedCurve }, (error: any, keys: { publicKey: string, privateKey: string }) => {
//         if (error) {
//           reject(error);
//         } else {
//           resolve({
//             publicKey: keys.publicKey,
//             privateKey: keys.privateKey
//           });
//         }
//       });
//     });
//   },

//   async exportKey(
//     format: string,
//     key: KeyPair
//   ): Promise<JsonWebKey | Uint8Array> {
//     if (format === 'jwk') {
//       // Assuming the public key is in ASN.1 DER format
//       const publicKeyBuffer = Buffer.from(key.publicKey, 'base64');
//       const publicKeyHex = publicKeyBuffer.toString('hex');
//       // Extract x and y coordinates (assuming uncompressed EC point)
//       const x = publicKeyHex.slice(2, 66);
//       const y = publicKeyHex.slice(66, 130);
      
//       return {
//         kty: 'EC',
//         crv: 'P-256',
//         x: Buffer.from(x, 'hex').toString('base64'),
//         y: Buffer.from(y, 'hex').toString('base64'),
//         d: key.privateKey // Assume privateKey is already in base64
//       };
//     } else if (format === 'raw') {
//       return Buffer.from(key.publicKey, 'base64');
//     } else {
//       throw new Error('Unsupported key export format');
//     }
//   },

//   async importKey(
//     format: string,
//     keyData: JwkKeyData,
//     { namedCurve }: { namedCurve: string },
//     exportable: boolean,
//     keyUsages: string[]
//   ): Promise<KeyPair> {
//     if (format !== 'jwk' || namedCurve !== 'P-256') {
//       throw new Error('Unsupported key import format or curve');
//     }

//     // Assuming keyData.x and keyData.y are in base64, convert them to a public key in ASN.1 DER format
//     const xBuffer = Buffer.from(keyData.x!, 'base64');
//     const yBuffer = Buffer.from(keyData.y!, 'base64');
//     const publicKey = `04${xBuffer.toString('hex')}${yBuffer.toString('hex')}`;

//     return {
//       publicKey: Buffer.from(publicKey, 'hex').toString('base64'),
//       privateKey: keyData.d! // Assume d is already in base64
//     };
//   }
// };
