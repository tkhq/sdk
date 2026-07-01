import { test, expect, describe } from "@jest/globals";
import { uint8ArrayFromHexString } from "@turnkey/encoding";
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha256";
import {
  getPublicKey,
  generateP256KeyPair,
  decryptCredentialBundle,
  extractPrivateKeyFromPKCS8Bytes,
  uncompressRawPublicKey,
  compressRawPublicKey,
  hpkeDecrypt,
  hpkeEncrypt,
  decryptExportBundle,
  hpkeAuthEncrypt,
  formatHpkeBuf,
  verifyStampSignature,
  verifySessionJwtSignature,
  verifyOtpVerificationToken,
  fromDerSignature,
} from "../";

// Mock data for testing
const mockSenderPrivateKey =
  "67ee05fc3bdf4161bc70701c221d8d77180294cefcfcea64ba83c4d4c732fcb9";
const mockPrivateKey =
  "20fa65df11f24833790ae283fc9a0c215eecbbc589549767977994dc69d05a56";
const mockCredentialBundle =
  "w99a5xV6A75TfoAUkZn869fVyDYvgVsKrawMALZXmrauZd8hEv66EkPU1Z42CUaHESQjcA5bqd8dynTGBMLWB9ewtXWPEVbZvocB4Tw2K1vQVp7uwjf";

describe("HPKE Encryption and Decryption", () => {
  test("hpkeAuthEncrypt and hpkeDecrypt - end-to-end encryption and decryption", () => {
    const senderKeyPair = generateP256KeyPair();
    const receiverKeyPair = generateP256KeyPair();
    const receiverPublicKeyUncompressed = uncompressRawPublicKey(
      uint8ArrayFromHexString(receiverKeyPair.publicKey),
    );

    const textEncoder = new TextEncoder();
    // Mock plaintext
    const plainText = "Hello, this is a secure message!";
    const plainTextBuf = textEncoder.encode(plainText);
    // Encrypt
    const encryptedDataBuf = hpkeAuthEncrypt({
      plainTextBuf: plainTextBuf,
      targetKeyBuf: receiverPublicKeyUncompressed,
      senderPriv: senderKeyPair.privateKey,
    });
    const encryptedData = formatHpkeBuf(encryptedDataBuf);
    // Extract the encapsulated key buffer and the ciphertext
    const data = JSON.parse(encryptedData);
    // Decrypt
    const decryptedData = hpkeDecrypt({
      ciphertextBuf: uint8ArrayFromHexString(data.ciphertext),
      encappedKeyBuf: uint8ArrayFromHexString(data.encappedPublic),
      receiverPriv: receiverKeyPair.privateKey,
    });

    // Convert decrypted data back to string
    const decryptedText = new TextDecoder().decode(decryptedData);

    // Expect the decrypted text to equal the original plaintext
    expect(decryptedText).toEqual(plainText);
  });
});

describe("HPKE Standard Encryption and Decryption", () => {
  test("hpkeEncrypt and hpkeDecrypt - standard mode (ephemeral sender key)", async () => {
    // Generate a receiver key pair
    const receiverKeyPair = generateP256KeyPair();
    const receiverPublicKeyUncompressed = uncompressRawPublicKey(
      uint8ArrayFromHexString(receiverKeyPair.publicKey),
    );

    // Prepare the plaintext
    const textEncoder = new TextEncoder();
    const plainText =
      "6ab33bd6e4bdc73017233da0554f9616fe10ede5c3ce001e81b321d5a74199b7";
    const plainTextBuf = textEncoder.encode(plainText);

    // Encrypt using standard mode (no sender private key provided)
    const encryptedDataBuf = hpkeEncrypt({
      plainTextBuf: plainTextBuf,
      targetKeyBuf: receiverPublicKeyUncompressed,
      // No senderPriv provided, so it will use an ephemeral key
    });
    const encryptedData = formatHpkeBuf(encryptedDataBuf);
    // Parse the encrypted data
    const data = JSON.parse(encryptedData);
    // Decrypt the message
    const decryptedData = hpkeDecrypt({
      ciphertextBuf: uint8ArrayFromHexString(data.ciphertext),
      encappedKeyBuf: uint8ArrayFromHexString(data.encappedPublic),
      receiverPriv: receiverKeyPair.privateKey,
    });

    // Convert decrypted data back to string
    const decryptedText = new TextDecoder().decode(decryptedData);

    // Verify that the decrypted text matches the original plaintext
    expect(decryptedText).toEqual(plainText);

    // Additional checks to ensure standard mode behavior
    const encappedPublicKey = uint8ArrayFromHexString(data.encappedPublic);
    expect(encappedPublicKey.length).toBe(65); // Uncompressed public key length
    expect(encappedPublicKey[0]).toBe(0x04); // Uncompressed public key prefix
  });
});

describe("decryptExportBundle Tests", () => {
  const exportBundle = `
    {
      "version": "v1.0.0",
      "data": "7b22656e6361707065645075626c6963223a2230343434313065633837653566653266666461313561313866613337376132316133633431633334373666383631333362343238306164373631303266343064356462326463353362343730303763636139336166666330613535316464353134333937643039373931636664393233306663613330343862313731663364363738222c2263697068657274657874223a22656662303538626633666634626534653232323330326266326636303738363062343237346232623031616339343536643362613638646135613235363236303030613839383262313465306261663061306465323966353434353461333739613362653664633364386339343938376131353638633764393566396663346239316265663232316165356562383432333361323833323131346431373962646664636631643066376164656231353766343131613439383430222c226f7267616e697a6174696f6e4964223a2266396133316336342d643630342d343265342d396265662d613737333039366166616437227d",
      "dataSignature": "304502203a7dc258590a637e76f6be6ed1a2080eed5614175060b9073f5e36592bdaf610022100ab9955b603df6cf45408067f652da48551652451b91967bf37dd094d13a7bdd4",
      "enclaveQuorumPublic": "04cf288fe433cc4e1aa0ce1632feac4ea26bf2f5a09dcfe5a42c398e06898710330f0572882f4dbdf0f5304b8fc8703acd69adca9a4bbf7f5d00d20a5e364b2569"
    }
  `;
  const privateKey =
    "ffc6090f14bcf260e5dfe63f45412e60a477bb905956d7cc90195b71c2a544b3";
  const organizationId = "f9a31c64-d604-42e4-9bef-a773096afad7";

  test("decryptExportBundle successfully decrypts a valid bundle - mnemonic", async () => {
    const expectedMnemonic =
      "leaf lady until indicate praise final route toast cake minimum insect unknown";

    const result = await decryptExportBundle({
      exportBundle,
      embeddedKey: privateKey,
      organizationId,
      keyFormat: "HEXADECIMAL",
      returnMnemonic: true,
    });

    expect(result).toEqual(expectedMnemonic);
  });

  test("decryptExportBundle successfully decrypts a valid bundle - non-mnemonic", async () => {
    const expectedNonMnemonic =
      "6c656166206c61647920756e74696c20696e646963617465207072616973652066696e616c20726f75746520746f6173742063616b65206d696e696d756d20696e7365637420756e6b6e6f776e";

    const result = await decryptExportBundle({
      exportBundle,
      embeddedKey: privateKey,
      organizationId,
      keyFormat: "HEXADECIMAL",
      returnMnemonic: false,
    });

    expect(result).toEqual(expectedNonMnemonic);
  });
});

describe("Turnkey Crypto Primitives", () => {
  test("getPublicKey - returns the correct public key", () => {
    const keyPair = generateP256KeyPair();
    const publicKey = getPublicKey(
      uint8ArrayFromHexString(keyPair.privateKey),
      true,
    );
    expect(publicKey).toHaveLength(33);
  });

  test("generateP256KeyPair - generates a valid key pair", () => {
    const keyPair = generateP256KeyPair();
    expect(keyPair.privateKey).toBeTruthy();
    expect(keyPair.publicKey).toBeTruthy();
    expect(keyPair.publicKeyUncompressed).toBeTruthy();
    expect(keyPair.privateKey).not.toEqual(keyPair.publicKey);
    expect(keyPair.publicKey).not.toEqual(keyPair.publicKeyUncompressed);
  });

  test("compressRawPublicKey - returns a valid value", () => {
    const { publicKey, publicKeyUncompressed } = generateP256KeyPair();
    expect(
      compressRawPublicKey(uint8ArrayFromHexString(publicKeyUncompressed)),
    ).toEqual(uint8ArrayFromHexString(publicKey));
  });

  test("decryptCredentialBundle - successfully decrypts a credential bundle", () => {
    const decryptedData = decryptCredentialBundle(
      mockCredentialBundle,
      mockPrivateKey,
    );
    expect(decryptedData).toBe(mockSenderPrivateKey);
  });

  test("extractPrivateKeyFromPKCS8Bytes", () => {
    const pkcs8PrivateKeyHex =
      "308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b020101042001d95d256f744b2a855fe2036ec1074c726445f1382f53580a17ce3296cc2deca1440342000440fa0a112351e0f5cdcc3edad914e7e3b911d3e83874d4ef55ff5639f4a3633e65087a8499c46a77f8e68c937203d85e6d38ade95d755a6cf88fa101091d5983";
    const expectedRawPrivateKeyHex =
      "01d95d256f744b2a855fe2036ec1074c726445f1382f53580a17ce3296cc2dec";
    expect(
      extractPrivateKeyFromPKCS8Bytes(
        uint8ArrayFromHexString(pkcs8PrivateKeyHex),
      ),
    ).toEqual(uint8ArrayFromHexString(expectedRawPrivateKeyHex));
  });

  test("verifyRequestStamp", async () => {
    const { publicKey: apiPublicKey, privateKey: apiPrivateKey } =
      generateP256KeyPair();

    // we create a sample request payload
    const requestBody = JSON.stringify({
      organizationId: "00000000-00000000-00000000-00000000",
      timestampMs: Date.now().toString(),
    });

    // we manually create a signature using @noble/curves directly
    // to avoid a circular dependency with ApiKeyStamper
    const messageHash = sha256(new TextEncoder().encode(requestBody));
    const privateKeyBytes = uint8ArrayFromHexString(apiPrivateKey);
    const signatureBytes = p256.sign(messageHash, privateKeyBytes).toDERHex();

    // we verify the signature
    const verified = await verifyStampSignature(
      apiPublicKey,
      signatureBytes,
      requestBody,
    );

    expect(verified).toEqual(true);
  });

  describe("uncompressRawPublicKey", () => {
    test("happy path", async () => {
      const keypair = generateP256KeyPair();
      const uncompressedPublicKey = uncompressRawPublicKey(
        uint8ArrayFromHexString(keypair.publicKey),
      );
      expect(uncompressedPublicKey.length).toEqual(65);
    });

    test("invalid prefix", async () => {
      const invalidPrefix = uint8ArrayFromHexString(
        "77c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5",
      );

      expect(() => uncompressRawPublicKey(invalidPrefix)).toThrow(
        "failed to uncompress raw public key: invalid prefix",
      );
    });

    test("invalid length", async () => {
      const keypair = generateP256KeyPair();

      expect(() =>
        uncompressRawPublicKey(
          uint8ArrayFromHexString(keypair.publicKey + keypair.publicKey),
        ),
      ).toThrow("failed to uncompress raw public key: invalid length");
    });
  });

  describe("Valid DER signatures", () => {
    test("should parse a simple DER signature with short-form length", () => {
      // Create a signature with 32-byte r and s values
      const rValue = new Array(32).fill(0x01);
      const sValue = new Array(32).fill(0x02);
      const totalLength = 2 + 32 + 2 + 32; // 2 bytes for each INTEGER header + values

      const derHex = createDerSignature([totalLength], rValue, sValue);

      expect(() => fromDerSignature(derHex)).not.toThrow();
    });

    test("should parse a DER signature with 33-byte integers (with leading zero)", () => {
      // ECDSA signatures sometimes have leading zeros to ensure positive integers
      const rValue = [0x00, ...new Array(32).fill(0x80)]; // Leading zero + high bit set
      const sValue = [0x00, ...new Array(32).fill(0x90)];
      const totalLength = 2 + 33 + 2 + 33;

      const derHex = createDerSignature([totalLength], rValue, sValue);

      expect(() => fromDerSignature(derHex)).not.toThrow();
    });
  });

  describe("Invalid signatures - missing SEQUENCE tag", () => {
    test("should reject signatures without SEQUENCE tag (0x30)", () => {
      const invalidHex = bytesToHex([
        0x31, // Wrong tag (should be 0x30)
        0x44, // Length of SEQUENCE
        0x02,
        0x20,
        ...new Array(32).fill(0x01), // r
        0x02,
        0x20,
        ...new Array(32).fill(0x02), // s
      ]);

      expect(() => fromDerSignature(invalidHex)).toThrow(
        "failed to convert DER-encoded signature: invalid format (missing SEQUENCE tag)",
      );
    });

    test("should reject empty signatures", () => {
      expect(() => fromDerSignature("")).toThrow(
        "cannot create uint8array from invalid hex string",
      );
    });

    test("should reject signatures that are too short", () => {
      const shortHex = bytesToHex([0x30]); // Only SEQUENCE tag, no length
      expect(() => fromDerSignature(shortHex)).toThrow(
        "failed to convert DER-encoded signature: insufficient length",
      );
    });
  });

  describe("Invalid signatures - length field issues", () => {
    test("should reject signatures with unsupported length encoding (0x80-0xFE range)", () => {
      const unsupportedLengthHex = bytesToHex([
        0x30, // SEQUENCE tag
        0x81, // Length encoding value that we do not want to support
        0x44, // Length value
        // ... rest of signature would follow
      ]);

      expect(() => fromDerSignature(unsupportedLengthHex)).toThrow(
        /large or invalid signature length/,
      );
    });

    test("should handle edge case of maximum short-form length (0x7F)", () => {
      // This would be a very large signature chunk with trailing data, but valid short-form
      const rValue = new Array(32).fill(0x01);
      const sValue = new Array(32).fill(0x02);

      const derHex = bytesToHex([
        0x30, // SEQUENCE tag
        0x7f, // Maximum short-form length of SEQUENCE
        0x02, // INTEGER tag
        0x20, // length of INTEGER
        ...rValue, // r (34 bytes total for INTEGER including header)
        0x02, // INTEGER tag
        0x20, // length of INTEGER
        ...sValue, // s (34 bytes total for INTEGER including header)
        ...new Array(0x7f - 68).fill(0x00), // Padding to reach 0x7F total length
      ]);

      expect(() => fromDerSignature(derHex)).not.toThrow();
    });

    test("should reject signatures with invalid r length", () => {
      const invalidRTagHex = bytesToHex([
        0x30, // SEQUENCE tag
        0x44, // length of SEQUENCE
        0x02, // Correct tag for r
        0x22, // length of INTEGER // invalid -- should be 32 or 33
        ...new Array(34).fill(0x01), // r
        0x02, // Correct tag for s
        0x20, // length of INTEGER
        ...new Array(32).fill(0x02), // s
      ]);

      expect(() => fromDerSignature(invalidRTagHex)).toThrow(
        /unexpected length for r/,
      );
    });

    test("should reject signatures with invalid s length", () => {
      const invalidRTagHex = bytesToHex([
        0x30, // SEQUENCE tag
        0x44, // length of SEQUENCE
        0x02, // Correct tag for r
        0x20, // length of INTEGER
        ...new Array(32).fill(0x01), // r
        0x02, // Correct tag for s
        0x22, // length of INTEGER // invalid -- should be 32 or 33
        ...new Array(34).fill(0x02), // s
      ]);

      expect(() => fromDerSignature(invalidRTagHex)).toThrow(
        /unexpected length for s/,
      );
    });

    test("should reject signatures with invalid, non-padding r bytes", () => {
      const invalidRTagHex = bytesToHex([
        0x30, // SEQUENCE tag
        0x44, // length of SEQUENCE
        0x02, // Correct tag for r
        0x21, // length of INTEGER // 33 -- this is valid
        ...new Array(33).fill(0x01), // r -- this is invalid, as the first byte in a 33 byte sequence is a non-padding byte
        0x02, // Correct tag for s
        0x20, // length of INTEGER
        ...new Array(32).fill(0x02), // s
      ]);

      expect(() => fromDerSignature(invalidRTagHex)).toThrow(
        /invalid number of starting zeroes/,
      );
    });

    test("should reject signatures with invalid, non-padding s bytes", () => {
      const invalidRTagHex = bytesToHex([
        0x30, // SEQUENCE tag
        0x44, // length of SEQUENCE
        0x02, // Correct tag for r
        0x20, // length of INTEGER
        ...new Array(32).fill(0x01), // r
        0x02, // Correct tag for s
        0x21, // length of INTEGER // 33 -- this is valid
        ...new Array(33).fill(0x02), // s -- this is invalid, as the first byte in a 33 byte sequence is a non-padding byte
      ]);

      expect(() => fromDerSignature(invalidRTagHex)).toThrow(
        /invalid number of starting zeroes/,
      );
    });
  });

  describe("Invalid signatures - INTEGER parsing", () => {
    test("should reject signatures with invalid r INTEGER tag", () => {
      const invalidRTagHex = bytesToHex([
        0x30, // SEQUENCE tag
        0x44, // length of SEQUENCE
        0x03, // WRONG tag for r (0x03 instead of 0x02)
        0x20, // length of INTEGER
        ...new Array(32).fill(0x01), // r
        0x02, // Correct tag for s
        0x20, // length of INTEGER
        ...new Array(32).fill(0x02), // s
      ]);

      expect(() => fromDerSignature(invalidRTagHex)).toThrow(
        /invalid tag for r/,
      );
    });

    test("should reject signatures with invalid s INTEGER tag", () => {
      const invalidSTagHex = bytesToHex([
        0x30, // SEQUENCE tag
        0x44, // length of SEQUENCE
        0x02, // Correct tag for r
        0x20, // length of INTEGER
        ...new Array(32).fill(0x01), // r
        0x03, // WRONG tag for s (0x03 instead of 0x02)
        0x20, // length of INTEGER
        ...new Array(32).fill(0x02), // s
      ]);

      expect(() => fromDerSignature(invalidSTagHex)).toThrow(
        /invalid tag for s/,
      );
    });
  });
});

describe("Session JWT signature", () => {
  test("verifies the provided JWT against its public key", async () => {
    const jwt =
      "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9." +
      "eyJleHAiOjE3NDg4NzY4MzcsInB1YmxpY19rZXkiOiIwMzk5ZmUyYWNlNjIwOGFmMGFkZjg0OGY0NGJjNDgyMTBiNTk0YjdlNjllY2Q5MWVjOTY4ZmQ3NWIzYmI0NDgzMzYiLCJzZXNzaW9uX3R5cGUiOiJTRVNTSU9OX1RZUEVfUkVBRF9XUklURSIsInVzZXJfaWQiOiI2OTEyYjgxOS1mNGRmLTQwZjQtYTE5Mi0yMGVlNDMwOTA5NzQiLCJvcmdhbml6YXRpb25faWQiOiJjNzVlY2IwNy1jODRhLTRkZDUtOTMyYy01MzlkZmFmYzY4NjQifQ." +
      "y6LPW1jlTwc9jFcvCwKJoKfleL_vHnGUr5tRVdMFUCnHvDspSPZ3DWK85tf1znCCBFQ6MYaFOl-1FLb0KcFxqQ";

    const ok = await verifySessionJwtSignature(jwt);
    expect(ok).toBe(true);
  });
});

describe("OTP Verification Token", () => {
  // Real enclave-issued token, signed with the production TLS fetcher key.
  const validJwt =
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9." +
    "eyJleHAiOiIxNzgyOTE5NjUxMjYxIiwiaWQiOiJlYjM5YjE5OS0zMzUyLTQyODktYjMxZi01NzE5NGM3OTYwOWMiLCJvcmdhbml6YXRpb25faWQiOiI3ZmYxODlmYi1kZjdkLTQ1MmUtODU0MC01NzYzMmUzODBiNzciLCJ2ZXJpZmljYXRpb25fdHlwZSI6Ik9UUF9UWVBFX0VNQUlMIiwiY29udGFjdCI6InVzZXJAZXhhbXBsZS5jb20iLCJwdWJsaWNfa2V5IjoiMDM2MzM1Yjc4ZjkyNzM2ZTMyZTk5ZGM2YWVkOTc5YWZmMGI1YzI0MTkyZTc2YjE2MjhhYTU0ZWRhZjU4YzhjMTVkIn0." +
    "YMtLA5vVUTiYhW5CIitrGXb-fk4MWx-MNVC4etopkKVro6tn0CP-Uz7biSZOunASsEc3jkjJWnFIn2AMpuZomg";

  // Deterministic test signer, used to exercise the claim-validation branch with a
  // *valid* signature — a real prod-signed token can never be missing a claim.
  const testPrivKey = uint8ArrayFromHexString(
    "7b2e9c5f4a1d8036e9b0c2a4f6d8e0f123456789abcdef0123456789abcdef01",
  );
  const testPubKeyHex = Buffer.from(p256.getPublicKey(testPrivKey)).toString(
    "hex",
  );
  const signTestToken = (claims: Record<string, unknown>): string => {
    const b64url = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");
    const signingInput = `${b64url({ typ: "JWT", alg: "ES256" })}.${b64url(claims)}`;
    const sig = p256
      .sign(sha256(new TextEncoder().encode(signingInput)), testPrivKey)
      .toCompactRawBytes();
    return `${signingInput}.${Buffer.from(sig).toString("base64url")}`;
  };

  test("verifies and decodes the OTP verification token JWT", async () => {
    const claims = await verifyOtpVerificationToken(validJwt);
    expect(claims.id).toBe("eb39b199-3352-4289-b31f-57194c79609c");
    expect(claims.verification_type).toBe("OTP_TYPE_EMAIL");
    expect(claims.contact).toBe("user@example.com");
    expect(claims.organization_id).toBe("7ff189fb-df7d-452e-8540-57632e380b77");
    expect(claims.public_key).toBe(
      "036335b78f92736e32e99dc6aed979aff0b5c24192e76b1628aa54edaf58c8c15d",
    );
    expect(claims.exp).toBe("1782919651261");
  });

  test("throws error for invalid JWT format", async () => {
    await expect(verifyOtpVerificationToken("invalid.jwt")).rejects.toThrow(
      "invalid JWT: need 3 parts",
    );
  });

  test("throws for an invalid signature", async () => {
    // Tamper the first signature char of the real token; JWT structure stays valid.
    const [h, p, s] = validJwt.split(".");
    const tampered = `${h}.${p}.${(s![0] === "A" ? "B" : "A") + s!.slice(1)}`;
    await expect(verifyOtpVerificationToken(tampered)).rejects.toThrow(
      "signature is invalid",
    );
  });

  const fullClaims: Record<string, string> = {
    id: "test-id",
    verification_type: "OTP_TYPE_EMAIL",
    contact: "user@example.com",
    organization_id: "test-org",
    public_key: "deadbeef",
    exp: "9999999999999",
  };

  test("throws for a validly-signed token missing a required claim", async () => {
    // Signed with the test key so the signature passes and we reach the
    // claim-validation branch; this token is missing the required `contact`.
    const claims: Record<string, unknown> = { ...fullClaims };
    delete claims.contact;
    const jwt = signTestToken(claims);
    await expect(
      verifyOtpVerificationToken(jwt, testPubKeyHex),
    ).rejects.toThrow("missing required 'contact' claim");
  });

  test("rejects a token signed by a different key than the override", async () => {
    // Token signed with the test key, but verified against the *production* key.
    const jwt = signTestToken(fullClaims);
    await expect(verifyOtpVerificationToken(jwt)).rejects.toThrow(
      "signature is invalid",
    );
  });
});

// Helper function to create hex strings from byte arrays
const bytesToHex = (bytes: number[]): string => {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
};

// Helper function to create a basic DER signature structure
const createDerSignature = (
  sequenceLength: number[],
  rValue: number[],
  sValue: number[],
): string => {
  const rLength = rValue.length;
  const sLength = sValue.length;

  return bytesToHex([
    0x30, // SEQUENCE tag
    ...sequenceLength, // Sequence length (can be multiple bytes)
    0x02, // INTEGER tag for r
    rLength, // r length (assuming single byte for simplicity)
    ...rValue,
    0x02, // INTEGER tag for s
    sLength, // s length (assuming single byte for simplicity)
    ...sValue,
  ]);
};
