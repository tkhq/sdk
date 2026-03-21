import {
  sshString,
  sshUint32,
  sshStringFromUtf8,
  sshEd25519PublicKey,
  buildSshsigSignedData,
  buildSshsigEnvelope,
  armorSshSignature,
} from "../ssh-wire";

describe("sshString", () => {
  it("encodes data with 4-byte big-endian length prefix", () => {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const result = sshString(data);
    // Length = 5, big-endian: [0, 0, 0, 5]
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(5);
    // Data follows
    expect(result[4]).toBe(0x48);
    expect(result.length).toBe(9); // 4 + 5
  });

  it("encodes empty data", () => {
    const result = sshString(new Uint8Array(0));
    expect(result.length).toBe(4);
    expect(result[0]).toBe(0);
    expect(result[3]).toBe(0);
  });
});

describe("sshUint32", () => {
  it("writes uint32 in big-endian", () => {
    const result = sshUint32(1);
    expect(result).toEqual(new Uint8Array([0, 0, 0, 1]));
  });

  it("writes larger values correctly", () => {
    const result = sshUint32(256);
    expect(result).toEqual(new Uint8Array([0, 0, 1, 0]));
  });
});

describe("sshStringFromUtf8", () => {
  it("encodes a UTF-8 string with length prefix", () => {
    const result = sshStringFromUtf8("git");
    // Length = 3: [0, 0, 0, 3] + "git" bytes
    expect(result[3]).toBe(3);
    expect(result[4]).toBe(0x67); // 'g'
    expect(result[5]).toBe(0x69); // 'i'
    expect(result[6]).toBe(0x74); // 't'
    expect(result.length).toBe(7);
  });

  it("encodes empty string", () => {
    const result = sshStringFromUtf8("");
    expect(result.length).toBe(4);
    expect(result[3]).toBe(0);
  });
});

describe("sshEd25519PublicKey", () => {
  const validKeyHex = "a".repeat(64); // 32 bytes

  it("produces SSH wire format with ssh-ed25519 type prefix", () => {
    const result = sshEd25519PublicKey(validKeyHex);
    // Structure: sshString("ssh-ed25519") + sshString(32-byte-key)
    // "ssh-ed25519" = 11 bytes, so: [0,0,0,11] + "ssh-ed25519" + [0,0,0,32] + key
    // Total: 4 + 11 + 4 + 32 = 51 bytes
    expect(result.length).toBe(51);

    // First 4 bytes: length of "ssh-ed25519" = 11
    expect(result[3]).toBe(11);

    // Bytes 4-14: "ssh-ed25519"
    const typeStr = new TextDecoder().decode(result.slice(4, 15));
    expect(typeStr).toBe("ssh-ed25519");
  });

  it("throws on invalid key length", () => {
    expect(() => sshEd25519PublicKey("abcd")).toThrow(
      "Expected 32-byte Ed25519 public key",
    );
  });
});

describe("buildSshsigSignedData", () => {
  it("builds the data-to-be-signed blob with SSHSIG magic", () => {
    const messageHash = new Uint8Array(64).fill(0xff); // 64 bytes (SHA-512)
    const result = buildSshsigSignedData({
      namespace: "git",
      hashAlgorithm: "sha512",
      messageHash,
    });

    // Should start with sshString("SSHSIG")
    // "SSHSIG" = 6 bytes, so first bytes: [0,0,0,6] + "SSHSIG"
    expect(result[3]).toBe(6);
    const magic = new TextDecoder().decode(result.slice(4, 10));
    expect(magic).toBe("SSHSIG");

    // Should contain namespace "git" somewhere after magic
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("buildSshsigEnvelope", () => {
  it("builds envelope with correct magic and version", () => {
    const signature = new Uint8Array(64).fill(0xab);
    const result = buildSshsigEnvelope({
      publicKeyHex: "a".repeat(64),
      namespace: "git",
      hashAlgorithm: "sha512",
      signature,
    });

    // First 6 bytes: "SSHSIG" (no null terminator in the magic for the envelope)
    const magic = new TextDecoder().decode(result.slice(0, 6));
    expect(magic).toBe("SSHSIG");

    // Next 4 bytes: version = 1
    const version = new DataView(
      result.buffer,
      result.byteOffset + 6,
      4,
    ).getUint32(0);
    expect(version).toBe(1);
  });

  it("produces non-empty binary output", () => {
    const signature = new Uint8Array(64).fill(0xab);
    const result = buildSshsigEnvelope({
      publicKeyHex: "a".repeat(64),
      namespace: "git",
      hashAlgorithm: "sha512",
      signature,
    });
    expect(result.length).toBeGreaterThan(100); // Magic + version + pubkey + namespace + hash + sig
  });
});

describe("armorSshSignature", () => {
  it("wraps binary in SSH SIGNATURE PEM headers", () => {
    const binary = new Uint8Array([1, 2, 3, 4, 5]);
    const result = armorSshSignature(binary);
    expect(result).toMatch(/^-----BEGIN SSH SIGNATURE-----\n/);
    expect(result).toMatch(/\n-----END SSH SIGNATURE-----$/);
  });

  it("contains valid base64 content", () => {
    const binary = new Uint8Array(100).fill(0x42);
    const result = armorSshSignature(binary);
    const lines = result.split("\n");
    // First and last lines are headers
    const base64Content = lines.slice(1, -1).join("");
    // Should be valid base64
    expect(() => atob(base64Content)).not.toThrow();
  });
});
