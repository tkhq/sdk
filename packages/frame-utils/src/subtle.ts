import { ec as EC } from 'elliptic';

const ec = new EC('p256');

  
export type KeyPair = EC.KeyPair
export interface JsonWebKey {
    alg?: string;
    crv?: string;
    d?: string;
    dp?: string;
    dq?: string;
    e?: string;
    ext?: boolean;
    k?: string;
    key_ops?: string[];
    kty?: string;
    n?: string;
    p?: string;
    q?: string;
    qi?: string;
    use?: string;
    x?: string;
    y?: string;
}

export interface JwkKeyData {
    kty: string | undefined;
    crv: string | undefined; 
    d?: string;
    x?: string;
    y?: string;
    ext: boolean | undefined;
}

  export const subtle = {
    async generateKey(
        { name, namedCurve }: { name: string; namedCurve: string },
        exportable: boolean,
        keyUsages: string[]
    ): Promise<KeyPair> {
        if (name !== 'ECDH' && name !== 'ECDSA') {
          throw new Error('Unsupported key generation algorithm');
        }
    
        return ec.genKeyPair();
    },

    async exportKey(
        format: string,
        key: EC.KeyPair
      ): Promise<JsonWebKey | Uint8Array> { 
        if (format === 'jwk') {
          const publicKey = key.getPublic();
          const privateKey = key.getPrivate();
          return {
            kty: 'EC',
            crv: 'P-256',
            x: publicKey.getX().toString(16),
            y: publicKey.getY().toString(16),
            d: privateKey.toString(16)
          };
        } else if (format === 'raw') {
          const publicKey = key.getPublic('array'); 
          return new Uint8Array(publicKey);
        } else {
          throw new Error('Unsupported key export format');
        }
      },
      

    async importKey(
        format: string,
        keyData: JwkKeyData,
        { name, namedCurve }: { name: string; namedCurve: string },
        exportable: boolean,
        keyUsages: string[]
    ): Promise<KeyPair> {
        if (format !== 'jwk' || namedCurve !== 'P-256') {
          throw new Error('Unsupported key import format or curve');
        }
      
        return ec.keyFromPrivate(keyData.d!, 'hex');
    }
};