import {
    generateTargetKey,
    importCredential,
    p256JWKPrivateToPublic,
    hpkeDecrypt,
    compressRawPublicKey,
    uncompressRawPublicKey,
    convertEcdsaIeee1363ToDer,
    hpkeEncrypt
} from '../keys.ts';
import { webcrypto } from 'crypto';
import { test, expect, describe } from '@jest/globals';

describe('Crypto Utility Functions', () => {
    // Test generateTargetKey
    test('generateTargetKey generates a valid private JWK for P-256', async () => {
        const privateJwk = await generateTargetKey();
        expect(privateJwk.kty).toBe('EC');
        expect(privateJwk.crv).toBe('P-256');
        expect(privateJwk.d).toBeDefined();
        expect(privateJwk.x).toBeDefined();
        expect(privateJwk.y).toBeDefined();
    });

    // Test importCredential
    test('importCredential imports a valid ECDSA private key', async () => {
        // Generate a key for testing
        const keyPair = await webcrypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign']
        );
        const exportedKey = await webcrypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        const cryptoKey = await importCredential(new Uint8Array(exportedKey));
        expect(cryptoKey).toBeDefined();
    });

    // Test p256JWKPrivateToPublic
    test('p256JWKPrivateToPublic converts a private JWK to a raw public key', async () => {
        const privateJwk = await generateTargetKey();
        const publicKeyBytes = await p256JWKPrivateToPublic(privateJwk);
        expect(publicKeyBytes.length).toBeGreaterThanOrEqual(1); // Raw public key length check
    });

    // Test compressRawPublicKey
    test('compressRawPublicKey correctly compresses a public key', () => {
        const publicKey = new Uint8Array([4, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33]);
        const compressedKey = compressRawPublicKey(publicKey);
        expect(compressedKey[0]).toBe(2); // Compression indicator
    });

    // Test uncompressRawPublicKey
    test('uncompressRawPublicKey correctly decompresses a public key', () => {
        const compressedKey = new Uint8Array([2, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
        const uncompressedKey = uncompressRawPublicKey(compressedKey);
        expect(uncompressedKey[0]).toBe(4); // Uncompression indicator
    });

    // Test convertEcdsaIeee1363ToDer
    test('convertEcdsaIeee1363ToDer converts a signature to DER format', () => {
        const ieeeSignature = new Uint8Array(64).fill(1);
        const derSignature = convertEcdsaIeee1363ToDer(ieeeSignature);
        expect(derSignature[0]).toBe(48); // DER sequence indicator
    });

    // Test hpkeEncrypt and hpkeDecrypt
    test('Encrypt and decrypt a message with key conversion', async () => {
        const privateJwk = await generateTargetKey();
        const rawPublicKey = await p256JWKPrivateToPublic(privateJwk);

        // Convert raw public key back to JsonWebKey
        const publicKey = await webcrypto.subtle.importKey(
            'raw',
            rawPublicKey,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['verify']
        );
        const publicJwk = await webcrypto.subtle.exportKey('jwk', publicKey);

        const plaintext = new TextEncoder().encode("Hello, world!");

        // Encrypt
        const { ciphertextBuf, encappedKeyBuf } = await hpkeEncrypt({
            plaintextBuf: plaintext,
            recipientPubJwk: publicJwk
        });

        // Decrypt
        const decryptedBuf = await hpkeDecrypt({
            ciphertextBuf,
            encappedKeyBuf,
            receiverPrivJwk: privateJwk
        });

        const decryptedText = new TextDecoder().decode(decryptedBuf);
        expect(decryptedText).toBe("Hello, world!");
    });
});
