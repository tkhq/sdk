import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { generateKeyPairSync, sign } from "crypto";
import { Wallet } from "ethers";
import { generateP256KeyPair } from "@turnkey/crypto";
import { bs58 } from "@turnkey/encoding";
import { TurnkeyErrorCodes } from "@turnkey/sdk-types";
import {
  buildWalletLoginMessage,
  defaultSiwxDomain,
  defaultSiwxUri,
  normalizeSiwxDomain,
  normalizeWalletSignature,
} from "../__wallet__/wallet-login-message";

const SESSION_PUBLIC_KEY =
  "02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";
const ETH_ADDRESS = "0xabc0000000000000000000000000000000000000";
const SOL_ADDRESS = bs58.encode(new Uint8Array(32).fill(1));

const GOLDEN_ETHEREUM = [
  "app.example.com wants you to sign in with your Ethereum account:",
  ETH_ADDRESS,
  "",
  "Authorize this key for wallet authentication.",
  "",
  "URI: https://app.example.com/login",
  "Version: 1",
  "Chain ID: 1",
  `Nonce: ${SESSION_PUBLIC_KEY}`,
  "Issued At: 2026-09-22T12:00:00Z",
  "Expiration Time: 2026-09-22T18:00:00Z",
  "Resources:",
  "- urn:turnkey:wallet-protocol:siwe",
  `- urn:turnkey:session-key:${SESSION_PUBLIC_KEY}`,
].join("\n");

function baseParams() {
  return {
    domain: "app.example.com",
    uri: "https://app.example.com/login",
    sessionPublicKey: SESSION_PUBLIC_KEY,
    chainId: "1",
    issuedAt: "2026-09-22T12:00:00Z",
    expirationTime: "2026-09-22T18:00:00Z",
  };
}

describe("buildWalletLoginMessage", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("matches the 14-line template byte for byte, including blank lines, with no trailing newline", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-22T12:00:00Z"));

    const message = buildWalletLoginMessage({
      ...baseParams(),
      chain: "Ethereum",
      walletAddress: ETH_ADDRESS,
    });

    expect(message).toBe(GOLDEN_ETHEREUM);
    expect(message.split("\n")).toHaveLength(14);
    expect(message.endsWith("\n")).toBe(false);
    expect(message.includes("\r")).toBe(false);
    expect(new TextEncoder().encode(message)).toEqual(
      new TextEncoder().encode(GOLDEN_ETHEREUM),
    );
  });

  it("binds nonce and session-key resource to generateP256KeyPair().publicKey.toLowerCase()", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-22T12:00:00Z"));

    const { publicKey } = generateP256KeyPair();
    const sessionPublicKey = publicKey.toLowerCase();
    const message = buildWalletLoginMessage({
      ...baseParams(),
      chain: "Ethereum",
      walletAddress: ETH_ADDRESS,
      sessionPublicKey,
    });

    expect(sessionPublicKey).toBe(publicKey.toLowerCase());
    expect(message).toContain(`Nonce: ${sessionPublicKey}`);
    expect(message).toContain(`- urn:turnkey:session-key:${sessionPublicKey}`);
    expect(sessionPublicKey).toMatch(/^(02|03)[0-9a-f]{64}$/);
  });

  it("does not construct Ethereum/siws or Solana/siwe", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-22T12:00:00Z"));

    const eth = buildWalletLoginMessage({
      ...baseParams(),
      chain: "Ethereum",
      walletAddress: ETH_ADDRESS,
    });
    expect(eth).toContain("your Ethereum account:");
    expect(eth).toContain("- urn:turnkey:wallet-protocol:siwe");
    expect(eth).not.toContain("wallet-protocol:siws");
    expect(eth).not.toContain("your Solana account:");

    const sol = buildWalletLoginMessage({
      ...baseParams(),
      chain: "Solana",
      walletAddress: SOL_ADDRESS,
    });
    expect(sol).toContain("your Solana account:");
    expect(sol).toContain("- urn:turnkey:wallet-protocol:siws");
    expect(sol).not.toContain("wallet-protocol:siwe");
    expect(sol).not.toContain("your Ethereum account:");
  });

  it("does not construct a trailing newline, CR, extra resource, or a changed statement", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-22T12:00:00Z"));

    const message = buildWalletLoginMessage({
      ...baseParams(),
      chain: "Ethereum",
      walletAddress: ETH_ADDRESS,
    });

    expect(message.endsWith("\n")).toBe(false);
    expect(message.includes("\r")).toBe(false);
    expect(message.match(/^- /gm)).toHaveLength(2);
    expect(message).toContain("Authorize this key for wallet authentication.");
    expect(message).not.toContain(
      "Authorize this key for wallet authentication!\n",
    );
  });

  it("rejects an issued-at more than 60 seconds in the future", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-22T12:00:00Z"));

    expect(() =>
      buildWalletLoginMessage({
        ...baseParams(),
        chain: "Ethereum",
        walletAddress: ETH_ADDRESS,
        issuedAt: "2026-09-22T12:01:01Z",
      }),
    ).toThrow(
      expect.objectContaining({
        code: TurnkeyErrorCodes.VALIDATION_ERROR,
      }),
    );
  });

  it("rejects an expiration time that is not strictly after now", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-22T12:00:00Z"));

    expect(() =>
      buildWalletLoginMessage({
        ...baseParams(),
        chain: "Ethereum",
        walletAddress: ETH_ADDRESS,
        expirationTime: "2026-09-22T12:00:00Z",
      }),
    ).toThrow(
      expect.objectContaining({
        code: TurnkeyErrorCodes.VALIDATION_ERROR,
      }),
    );
  });

  it("checksums Ethereum addresses (EIP-55)", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-22T12:00:00Z"));

    const message = buildWalletLoginMessage({
      ...baseParams(),
      chain: "Ethereum",
      walletAddress: "0xe91f454f985c19207080378fe0f5a47daeca2b3e",
    });

    expect(message).toContain("0xe91F454F985c19207080378FE0f5A47DAeca2B3E");
    expect(message).not.toContain(
      "0xe91f454f985c19207080378fe0f5a47daeca2b3e\n",
    );
  });

  it("rejects a URI whose host does not match the domain", () => {
    expect(() =>
      buildWalletLoginMessage({
        ...baseParams(),
        chain: "Ethereum",
        walletAddress: ETH_ADDRESS,
        uri: "https://other.example.com/login",
      }),
    ).toThrow(
      expect.objectContaining({
        code: TurnkeyErrorCodes.VALIDATION_ERROR,
      }),
    );
  });
});

describe("normalizeSiwxDomain", () => {
  it("lowercases, strips scheme/path, and drops ports 80 and 443", () => {
    expect(normalizeSiwxDomain("HTTPS://App.Example.COM:443/login")).toBe(
      "app.example.com",
    );
    expect(normalizeSiwxDomain("app.example.com:80")).toBe("app.example.com");
    expect(normalizeSiwxDomain("app.example.com:3000")).toBe(
      "app.example.com:3000",
    );
  });
});

describe("default SIWx domain and URI (mobile / WalletConnect metadata)", () => {
  it("uses WalletConnect appMetadata.url when window.location is unavailable", () => {
    expect(defaultSiwxDomain("https://app.example.com")).toBe(
      "app.example.com",
    );
    expect(defaultSiwxUri("https://app.example.com")).toBe(
      "https://app.example.com",
    );
    expect(defaultSiwxDomain("https://App.Example.COM:443/login")).toBe(
      "app.example.com",
    );
    expect(defaultSiwxUri("app.example.com")).toBe("https://app.example.com");
  });
});

describe("wallet login signatures", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("ethereum personal_sign produces 65-byte hex", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-22T12:00:00Z"));

    const wallet = new Wallet("0x" + "11".repeat(32));
    const message = buildWalletLoginMessage({
      ...baseParams(),
      chain: "Ethereum",
      walletAddress: wallet.address,
    });
    const signature = await wallet.signMessage(message);
    const normalized = normalizeWalletSignature(signature, "Ethereum");

    expect(normalized).toHaveLength(130);
    expect(Buffer.from(normalized, "hex").byteLength).toBe(65);
  });

  it("solana raw ed25519 produces 64-byte hex", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-22T12:00:00Z"));

    const { privateKey } = generateKeyPairSync("ed25519");
    const message = buildWalletLoginMessage({
      ...baseParams(),
      chain: "Solana",
      walletAddress: SOL_ADDRESS,
    });
    const signature = sign(null, Buffer.from(message, "utf8"), privateKey);
    const normalized = normalizeWalletSignature(
      Buffer.from(signature).toString("hex"),
      "Solana",
    );

    expect(signature.byteLength).toBe(64);
    expect(normalized).toHaveLength(128);
    expect(Buffer.from(normalized, "hex").byteLength).toBe(64);
  });
});
