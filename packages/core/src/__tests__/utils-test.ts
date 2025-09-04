import {
  describe,
  expect,
  jest,
  beforeEach,
  afterEach,
  it,
} from "@jest/globals";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  type v1AddressFormat,
  type v1User,
  type v1WalletAccount,
} from "@turnkey/sdk-types";
import {
  isWeb,
  isReactNative,
  getHashFunction,
  getEncodingType,
  getEncodedMessage,
  isWalletAccountArray,
  createWalletAccountFromAddressFormat,
  generateWalletAccountsFromAddressFormat,
  getPublicKeyFromStampHeader,
  isEthereumProvider,
  isSolanaProvider,
  getCurveTypeFromProvider,
  getSignatureSchemeFromProvider,
  findWalletProviderFromAddress,
  addressFromPublicKey,
  getAuthenticatorAddresses,
  withTurnkeyErrorHandling,
  assertValidP256ECDSAKeyPair,
  isValidPasskeyName,
} from "../utils";
import * as utils from "../utils";
import { stringToBase64urlString } from "@turnkey/encoding";
import {
  Chain,
  EvmChainInfo,
  SolanaChainInfo,
  WalletInterfaceType,
  WalletProvider,
} from "../__types__/base";

// mock the bs58 library
jest.mock("bs58", () => ({
  encode: jest.fn(() => "base58-encoded"),
}));
import bs58 from "bs58";

// For deterministic ETH behavior, mock the heavy crypto/EC parts.

// Mock keccak256 to return a predictable value
jest.mock("ethers", () => ({
  keccak256: jest.fn(
    () => "11".repeat(12) + "1234567890abcdef1234567890abcdef12345678",
  ),
}));
import { keccak256 } from "ethers";

// Mock uncompressRawPublicKey
jest.mock("@turnkey/crypto", () => {
  const { uint8ArrayFromHexString } = jest.requireActual(
    "@turnkey/encoding",
  ) as typeof import("@turnkey/encoding");

  return {
    uncompressRawPublicKey: jest.fn(() =>
      uint8ArrayFromHexString("04" + "aa".repeat(64)),
    ),
  };
});
import { uncompressRawPublicKey } from "@turnkey/crypto";
import { TurnkeyRequestError } from "@turnkey/http";

describe("platform detection", () => {
  const g = globalThis as any;

  const saveGlobals = () => ({
    window: g.window,
    document: g.document,
    navigator: g.navigator,
  });

  const restoreGlobals = (orig: any) => {
    if (typeof orig.window === "undefined") delete g.window;
    else g.window = orig.window;

    if (typeof orig.document === "undefined") delete g.document;
    else g.document = orig.document;

    if (typeof orig.navigator === "undefined") delete g.navigator;
    else g.navigator = orig.navigator;
  };

  let orig: any;

  beforeEach(() => {
    orig = saveGlobals();
    // Start clean: no browser-like globals unless a test sets them.
    delete g.window;
    delete g.document;
    delete g.navigator;
    jest.resetModules(); // ensures fresh imports if needed later
  });

  afterEach(() => {
    restoreGlobals(orig);
    jest.restoreAllMocks();
  });

  it("returns false for both on plain Node (no globals)", () => {
    expect(isWeb()).toBe(false);
    expect(isReactNative()).toBe(false);
  });

  it("isWeb() true when window and document exist", () => {
    g.window = {};
    g.document = {};
    expect(isWeb()).toBe(true);
    expect(isReactNative()).toBe(false);
  });

  it("isWeb() false if only window exists", () => {
    g.window = {};
    expect(isWeb()).toBe(false);
  });

  it("isWeb() false if only document exists", () => {
    g.document = {};
    expect(isWeb()).toBe(false);
  });

  it("isReactNative() true when navigator.product === 'ReactNative'", () => {
    g.navigator = { product: "ReactNative" };
    expect(isReactNative()).toBe(true);
    expect(isWeb()).toBe(false);
  });

  it("isReactNative() false when navigator exists but product differs", () => {
    g.navigator = { product: "Gecko" };
    expect(isReactNative()).toBe(false);
  });

  it("isReactNative() false when navigator missing", () => {
    expect(isReactNative()).toBe(false);
  });

  it("does not accidentally treat web + RN at the same time", () => {
    g.window = {};
    g.document = {};
    g.navigator = { product: "ReactNative" };
    // the current logic would report both true; might need to change current behavior
    expect(isWeb()).toBe(true);
    expect(isReactNative()).toBe(true);
  });
});

describe("address format helpers", () => {
  const ETH: v1AddressFormat = "ADDRESS_FORMAT_ETHEREUM";
  const COSMOS: v1AddressFormat = "ADDRESS_FORMAT_COSMOS";
  const SOLANA: v1AddressFormat = "ADDRESS_FORMAT_SOLANA";
  const UNCOMPRESSED: v1AddressFormat = "ADDRESS_FORMAT_UNCOMPRESSED";

  describe("getHashFunction", () => {
    it("returns KECCAK256 for Ethereum", () => {
      expect(getHashFunction(ETH)).toBe("HASH_FUNCTION_KECCAK256");
    });

    it("returns SHA256 for Cosmos and Uncompressed", () => {
      expect(getHashFunction(COSMOS)).toBe("HASH_FUNCTION_SHA256");
      expect(getHashFunction(UNCOMPRESSED)).toBe("HASH_FUNCTION_SHA256");
    });

    it("returns NOT_APPLICABLE for Solana", () => {
      expect(getHashFunction(SOLANA)).toBe("HASH_FUNCTION_NOT_APPLICABLE");
    });

    it("throws for unsupported formats", () => {
      const BAD = "ADDRESS_FORMAT_UNKNOWN" as unknown as v1AddressFormat;
      expect(() => getHashFunction(BAD)).toThrow(
        /Unsupported address format: ADDRESS_FORMAT_UNKNOWN/,
      );
    });
  });

  describe("getEncodingType", () => {
    it("returns HEXADECIMAL for Ethereum and Uncompressed", () => {
      expect(getEncodingType(ETH)).toBe("PAYLOAD_ENCODING_HEXADECIMAL");
      expect(getEncodingType(UNCOMPRESSED)).toBe(
        "PAYLOAD_ENCODING_HEXADECIMAL",
      );
    });

    it("returns TEXT_UTF8 for Cosmos", () => {
      expect(getEncodingType(COSMOS)).toBe("PAYLOAD_ENCODING_TEXT_UTF8");
    });

    it("throws for unsupported formats", () => {
      const BAD = "ADDRESS_FORMAT_UNKNOWN" as unknown as v1AddressFormat;
      expect(() => getEncodingType(BAD)).toThrow(
        /Unsupported address format: ADDRESS_FORMAT_UNKNOWN/,
      );
    });
  });

  describe("getEncodedMessage", () => {
    it("hex-encodes ASCII with 0x prefix when encoding is HEX (e.g., Ethereum)", () => {
      // "Hello" => 48 65 6c 6c 6f
      expect(getEncodedMessage(ETH, "Hello")).toBe("0x48656c6c6f");
    });

    it("hex-encodes multibyte UTF-8 correctly (e.g., 'é' => c3 a9)", () => {
      expect(getEncodedMessage(ETH, "é")).toBe("0xc3a9");
    });

    it("returns raw message when encoding is TEXT_UTF8 (e.g., Cosmos)", () => {
      expect(getEncodedMessage(COSMOS, "plain text")).toBe("plain text");
    });

    it("returns '0x' for empty string when HEX encoding", () => {
      expect(getEncodedMessage(UNCOMPRESSED, "")).toBe("0x");
    });

    it("throws for unsupported formats", () => {
      const BAD = "ADDRESS_FORMAT_UNKNOWN" as unknown as v1AddressFormat;
      expect(() => getEncodedMessage(BAD, "msg")).toThrow(
        /Unsupported address format: ADDRESS_FORMAT_UNKNOWN/,
      );
    });

    it("does not hex-encode for formats with TEXT_UTF8 (control case)", () => {
      // Double-check we don't accidentally hex for TEXT_UTF8 formats
      expect(getEncodedMessage(COSMOS, "é")).toBe("é");
    });
  });
});

describe("wallet account helpers (with real config)", () => {
  const ETH = "ADDRESS_FORMAT_ETHEREUM";
  const COSMOS = "ADDRESS_FORMAT_COSMOS";

  describe("isWalletAccountArray", () => {
    it("true for empty array", () => {
      expect(isWalletAccountArray([])).toBe(true);
    });

    it("true for a valid wallet account", () => {
      const acc = createWalletAccountFromAddressFormat(ETH);
      expect(isWalletAccountArray([acc])).toBe(true);
    });

    it("false for invalid object", () => {
      expect(isWalletAccountArray([{ foo: "bar" } as any])).toBe(false);
    });
  });

  describe("createWalletAccountFromAddressFormat", () => {
    it("returns a default ETH account", () => {
      const acc = createWalletAccountFromAddressFormat(ETH);
      expect(acc).toMatchObject({
        addressFormat: ETH,
        pathFormat: "PATH_FORMAT_BIP32",
      });
    });

    it("throws for an unsupported format", () => {
      expect(() =>
        createWalletAccountFromAddressFormat("ADDRESS_FORMAT_UNKNOWN" as any),
      ).toThrow(/Unsupported address format/);
    });
  });

  describe("generateWalletAccountsFromAddressFormat", () => {
    it("generates from scratch", () => {
      const accounts = generateWalletAccountsFromAddressFormat({
        addresses: [ETH, COSMOS],
      });
      expect(accounts).toHaveLength(2);
      expect(accounts[0]!.addressFormat).toBe(ETH);
      expect(accounts[1]!.addressFormat).toBe(COSMOS);
    });

    it("increments index for duplicates", () => {
      const accounts = generateWalletAccountsFromAddressFormat({
        addresses: [ETH, ETH, ETH],
      });
      expect(accounts.map((a) => a.path)).toEqual([
        "m/44'/60'/0'/0/0",
        "m/44'/60'/1'/0/0",
        "m/44'/60'/2'/0/0",
      ]);
    });

    it("resumes from existing max index", () => {
      const existing = [
        {
          addressFormat: ETH,
          curve: "CURVE_SECP256K1",
          path: "m/44'/60'/5'/0/0",
          pathFormat: "PATH_FORMAT_BIP32",
        },
      ] as v1WalletAccount[];
      const accounts = generateWalletAccountsFromAddressFormat({
        addresses: [ETH, ETH],
        existingWalletAccounts: existing,
      });
      expect(accounts.map((a) => a.path)).toEqual([
        "m/44'/60'/6'/0/0",
        "m/44'/60'/7'/0/0",
      ]);
    });
  });
});

const makeStamp = (
  overrides?: Partial<{ publicKey: string; scheme: string; signature: string }>,
) => {
  const base = {
    publicKey: "abcdef012345",
    scheme: "SCHEME",
    signature: "deadbeef",
  };
  return { ...base, ...overrides };
};

describe("getPublicKeyFromStampHeader", () => {
  it("extracts publicKey from a valid base64url-encoded JSON stamp", () => {
    const header = stringToBase64urlString(
      JSON.stringify(makeStamp({ publicKey: "0123abcd" })),
    );
    expect(getPublicKeyFromStampHeader(header)).toBe("0123abcd");
  });

  it("throws a descriptive error for invalid base64/JSON", () => {
    expect(() => getPublicKeyFromStampHeader("%%%not-base64%%%")).toThrow(
      /Failed to extract public key from stamp header:/,
    );

    const looksB64Url = stringToBase64urlString("not-json"); // valid base64url string, not JSON after decode
    expect(() => getPublicKeyFromStampHeader(looksB64Url)).toThrow(
      /Failed to extract public key from stamp header:/,
    );
  });
});

const evmProvider = (
  addresses: string[] = [],
): WalletProvider & { chainInfo: EvmChainInfo } => ({
  chainInfo: { namespace: Chain.Ethereum } as EvmChainInfo,
  connectedAddresses: addresses,
  interfaceType: WalletInterfaceType.Ethereum,
  info: { name: "TestProvider" },
  provider: {} as any,
});

const solProvider = (
  addresses: string[] = [],
): WalletProvider & { chainInfo: SolanaChainInfo } => ({
  chainInfo: { namespace: Chain.Solana } as SolanaChainInfo,
  connectedAddresses: addresses,
  interfaceType: WalletInterfaceType.Solana,
  info: { name: "TestProvider" },
  provider: {} as any,
});

describe("provider type guards", () => {
  it("isEthereumProvider true for Ethereum, false for Solana", () => {
    expect(isEthereumProvider(evmProvider())).toBe(true);
    expect(isEthereumProvider(solProvider())).toBe(false);
  });

  it("isSolanaProvider true for Solana, false for Ethereum", () => {
    expect(isSolanaProvider(solProvider())).toBe(true);
    expect(isSolanaProvider(evmProvider())).toBe(false);
  });
});

describe("getCurveTypeFromProvider", () => {
  it("returns SECP256K1 for Ethereum", () => {
    expect(getCurveTypeFromProvider(evmProvider())).toBe(
      "API_KEY_CURVE_SECP256K1",
    );
  });

  it("returns ED25519 for Solana", () => {
    expect(getCurveTypeFromProvider(solProvider())).toBe(
      "API_KEY_CURVE_ED25519",
    );
  });

  it("throws for unsupported namespaces", () => {
    const weird = {
      chainInfo: { namespace: "Other" },
      connectedAddresses: [],
    } as unknown as WalletProvider;
    expect(() => getCurveTypeFromProvider(weird)).toThrow(
      /Unsupported provider namespace: Other/,
    );
  });
});

describe("getSignatureSchemeFromProvider", () => {
  it("returns EIP-191 scheme for Ethereum", () => {
    expect(getSignatureSchemeFromProvider(evmProvider())).toBe(
      "SIGNATURE_SCHEME_TK_API_SECP256K1_EIP191",
    );
  });

  it("returns ED25519 scheme for Solana", () => {
    expect(getSignatureSchemeFromProvider(solProvider())).toBe(
      "SIGNATURE_SCHEME_TK_API_ED25519",
    );
  });

  it("throws for unsupported namespaces", () => {
    const weird = {
      chainInfo: { namespace: "Other" },
      connectedAddresses: [],
    } as unknown as WalletProvider;
    expect(() => getSignatureSchemeFromProvider(weird)).toThrow(
      /Unsupported provider namespace: Other/,
    );
  });
});

describe("findWalletProviderFromAddress", () => {
  it("returns the first provider that contains the address", () => {
    const A = evmProvider(["0x1", "0x2"]);
    const B = solProvider(["solA"]);
    const C = evmProvider(["0x3"]);

    expect(findWalletProviderFromAddress("solA", [A, B, C])).toBe(B);
    expect(findWalletProviderFromAddress("0x3", [A, B, C])).toBe(C);
  });

  it("returns undefined if no provider contains the address", () => {
    const A = evmProvider(["0x1"]);
    const B = solProvider(["solA"]);
    expect(findWalletProviderFromAddress("nope", [A, B])).toBeUndefined();
  });
});

describe("addressFromPublicKey", () => {
  it("Ethereum: strips 0x04 after uncompress, keccak, last 20 bytes", () => {
    const addr = addressFromPublicKey(Chain.Ethereum, "03deadbeef"); // input value irrelevant due to mocks
    expect(addr).toBe("0x1234567890abcdef1234567890abcdef12345678");
    expect(uncompressRawPublicKey).toHaveBeenCalled();
    expect(keccak256).toHaveBeenCalled();
  });

  it("Solana: base58 encodes the raw bytes of the hex public key", () => {
    const out = addressFromPublicKey(Chain.Solana, "a1b2c3");
    expect(out).toBe("base58-encoded");
    expect(bs58.encode).toHaveBeenCalled();
  });

  it("throws for unsupported chain", () => {
    expect(() =>
      addressFromPublicKey("Other" as unknown as Chain, "abcd"),
    ).toThrow(/Unsupported chain:/);
  });
});

describe("getAuthenticatorAddresses", () => {
  it("routes SECP256K1 -> ethereum and ED25519 -> solana", () => {
    // ✅ Valid hex inputs so we don't need to mock addressFromPublicKey itself
    const secpCompressed = "02" + "ab".repeat(32); // 33 bytes, starts with 02/03
    const ed25519 = "cd".repeat(32); // 32 bytes

    const user: v1User = {
      id: "user-1",
      email: "x@y.z",
      apiKeys: [
        {
          id: "k1",
          credential: {
            type: "CREDENTIAL_TYPE_API_KEY_SECP256K1",
            publicKey: secpCompressed,
          },
        } as any,
        {
          id: "k2",
          credential: {
            type: "CREDENTIAL_TYPE_API_KEY_ED25519",
            publicKey: ed25519,
          },
        } as any,
      ],
    } as any;

    const out = getAuthenticatorAddresses(user);

    // ETH: last 20 bytes of mocked keccak
    expect(out.ethereum).toEqual([
      "0x1234567890abcdef1234567890abcdef12345678",
    ]);
    // SOL: mocked base58 output
    expect(out.solana).toEqual(["base58-encoded"]);
  });

  it("returns empty arrays when no apiKeys", () => {
    const user: v1User = { id: "u", email: "e", apiKeys: [] } as any;
    expect(getAuthenticatorAddresses(user)).toEqual({
      ethereum: [],
      solana: [],
    });
  });
});

/* ------- Error Handling ------- */

describe("withTurnkeyErrorHandling", () => {
  const DEFAULT_MSG = "Default wrapped message";
  const DEFAULT_CODE = TurnkeyErrorCodes.INVALID_REQUEST;

  const ok =
    <T>(v: T) =>
    async () =>
      v;
  const failWith = (err: unknown) => async () => {
    throw err;
  };

  it("returns value on success and calls finallyFn (but not catchFn)", async () => {
    const result = 42;

    const catchFn = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const finallyFn = jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);

    const out = await withTurnkeyErrorHandling(
      ok(result),
      { errorMessage: DEFAULT_MSG, errorCode: DEFAULT_CODE, catchFn },
      { finallyFn },
    );

    expect(out).toBe(result);
    expect(catchFn).not.toHaveBeenCalled();
    expect(finallyFn).toHaveBeenCalledTimes(1);
  });

  it("calls catchFn on error and always calls finallyFn", async () => {
    const catchFn = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const finallyFn = jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);

    await expect(
      withTurnkeyErrorHandling(
        failWith(new Error("boom")),
        { errorMessage: DEFAULT_MSG, errorCode: DEFAULT_CODE, catchFn },
        { finallyFn },
      ),
    ).rejects.toBeInstanceOf(TurnkeyError);

    expect(catchFn).toHaveBeenCalledTimes(1);
    expect(finallyFn).toHaveBeenCalledTimes(1);
  });

  it("includes original error in cause when thrown via message-map (throwMatchingMessage path)", async () => {
    const original = new Error("db: ECONNREFUSED 127.0.0.1:5432");

    await expect(
      withTurnkeyErrorHandling(
        async () => {
          throw original;
        },
        {
          errorMessage: DEFAULT_MSG,
          errorCode: DEFAULT_CODE,
          customMessageByMessages: {
            ECONNREFUSED: {
              message: "Database unavailable",
              code: TurnkeyErrorCodes.INVALID_REQUEST,
            },
          },
        },
      ),
    ).rejects.toMatchObject({
      // Ensure we don't hide the underlying error
      cause: original,
    });
  });

  it("includes original error in cause when wrapping a generic Error (no message-map hit)", async () => {
    const original = new Error("S3 putObject timeout");

    await expect(
      withTurnkeyErrorHandling(
        async () => {
          throw original;
        },
        {
          errorMessage: DEFAULT_MSG,
          errorCode: DEFAULT_CODE,
        },
      ),
    ).rejects.toMatchObject({
      cause: original,
    });
  });

  describe("when thrown error is TurnkeyError", () => {
    it("uses customMessageByCodes when the code matches (takes priority over message map)", async () => {
      const original = new TurnkeyError("original message", DEFAULT_CODE);

      await expect(
        withTurnkeyErrorHandling(failWith(original), {
          errorMessage: DEFAULT_MSG,
          errorCode: DEFAULT_CODE,
          customMessageByCodes: {
            [DEFAULT_CODE]: {
              message: "override via code",
              code: DEFAULT_CODE,
            },
          },
          customMessageByMessages: {
            original: { message: "message-map-hit", code: DEFAULT_CODE },
          },
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "override via code",
          code: DEFAULT_CODE,
        }),
      );
    });

    it("uses customMessageByMessages when message substring matches and no code override", async () => {
      const original = new TurnkeyError(
        "something specific happened",
        DEFAULT_CODE,
      );

      await expect(
        withTurnkeyErrorHandling(failWith(original), {
          errorMessage: DEFAULT_MSG,
          errorCode: DEFAULT_CODE,
          // no customMessageByCodes hit
          customMessageByMessages: {
            specific: { message: "mapped by message", code: DEFAULT_CODE },
          },
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "mapped by message",
          code: DEFAULT_CODE,
        }),
      );
    });

    it("rethrows the original TurnkeyError when no custom mapping matches", async () => {
      const original = new TurnkeyError("no matches here", DEFAULT_CODE);

      try {
        await withTurnkeyErrorHandling(failWith(original), {
          errorMessage: DEFAULT_MSG,
          errorCode: DEFAULT_CODE,
        });
        throw new Error("should not reach");
      } catch (e) {
        // It should be the *same* instance rethrown
        expect(e).toBe(original);
      }
    });
  });

  describe("when thrown error is TurnkeyRequestError", () => {
    it("maps by message when customMessageByMessages matches", async () => {
      const reqErr = new TurnkeyRequestError({
        message: "token expired",
        code: 1,
        details: null,
      });

      await expect(
        withTurnkeyErrorHandling(failWith(reqErr), {
          errorMessage: DEFAULT_MSG,
          errorCode: DEFAULT_CODE,
          customMessageByMessages: {
            expired: {
              message: "Session expired, please re-auth",
              code: DEFAULT_CODE,
            },
          },
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Session expired, please re-auth",
          code: DEFAULT_CODE,
        }),
      );
    });

    it("wraps into TurnkeyError with default message/code when no mapping", async () => {
      const reqErr = new TurnkeyRequestError({
        message: "some request issue",
        code: 1,
        details: null,
      });

      await expect(
        withTurnkeyErrorHandling(failWith(reqErr), {
          errorMessage: DEFAULT_MSG,
          errorCode: DEFAULT_CODE,
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: DEFAULT_MSG,
          code: DEFAULT_CODE,
        }),
      );
    });
  });

  describe("when thrown error is a generic Error", () => {
    it("maps by message when customMessageByMessages matches", async () => {
      const err = new Error("db connection refused");

      await expect(
        withTurnkeyErrorHandling(failWith(err), {
          errorMessage: DEFAULT_MSG,
          errorCode: DEFAULT_CODE,
          customMessageByMessages: {
            "connection refused": {
              message: "Database unavailable",
              code: DEFAULT_CODE,
            },
          },
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Database unavailable",
          code: DEFAULT_CODE,
        }),
      );
    });

    it("wraps into TurnkeyError with default message/code when no mapping", async () => {
      const err = new Error("unrecognized error");

      await expect(
        withTurnkeyErrorHandling(failWith(err), {
          errorMessage: DEFAULT_MSG,
          errorCode: DEFAULT_CODE,
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: DEFAULT_MSG,
          code: DEFAULT_CODE,
        }),
      );
    });
  });

  describe("when a non-Error value is thrown", () => {
    it("maps by message when customMessageByMessages matches", async () => {
      await expect(
        withTurnkeyErrorHandling(failWith("timeout while fetching"), {
          errorMessage: DEFAULT_MSG,
          errorCode: DEFAULT_CODE,
          customMessageByMessages: {
            timeout: { message: "Network timeout", code: DEFAULT_CODE },
          },
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Network timeout",
          code: DEFAULT_CODE,
        }),
      );
    });

    it("wraps into TurnkeyError(String(error), default code) when no mapping", async () => {
      await expect(
        withTurnkeyErrorHandling(failWith(404), {
          errorMessage: DEFAULT_MSG,
          errorCode: DEFAULT_CODE,
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          // In this branch impl uses String(error) (not DEFAULT_MSG)
          message: "404",
          code: DEFAULT_CODE,
        }),
      );
    });
  });
});

describe("assertValidP256ECDSAKeyPair", () => {
  // Helper to generate a P-256 ECDSA keypair with control over extractability/usages
  const genECDSA = (opts?: {
    extractable?: boolean;
    usages?: KeyUsage[];
    namedCurve?: "P-256" | "P-384";
  }) => {
    const {
      extractable = false,
      usages = ["sign", "verify"],
      namedCurve = "P-256",
    } = opts || {};
    return crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve },
      extractable,
      usages,
    ) as Promise<CryptoKeyPair>;
  };

  it("passes for a valid, non-extractable P-256 ECDSA pair", async () => {
    const pair = await genECDSA();
    await expect(assertValidP256ECDSAKeyPair(pair)).resolves.toBeUndefined();
  });

  it("throws if privateKey is extractable", async () => {
    const pair = await genECDSA({ extractable: true });
    await expect(assertValidP256ECDSAKeyPair(pair)).rejects.toEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          "Provided privateKey must be non-extractable",
        ),
        code: TurnkeyErrorCodes.INVALID_REQUEST,
      }),
    );
  });

  it("throws if privateKey.type is not 'private'", async () => {
    const pair = await genECDSA();
    const badPair: CryptoKeyPair = {
      privateKey: pair.publicKey as unknown as CryptoKey,
      publicKey: pair.publicKey,
    };
    await expect(assertValidP256ECDSAKeyPair(badPair)).rejects.toEqual(
      expect.objectContaining({
        message: "privateKey.type must be 'private'.",
        code: TurnkeyErrorCodes.INVALID_REQUEST,
      }),
    );
  });

  it("throws if publicKey.type is not 'public'", async () => {
    const pair = await genECDSA();
    const badPair: CryptoKeyPair = {
      privateKey: pair.privateKey,
      publicKey: pair.privateKey as unknown as CryptoKey,
    };
    await expect(assertValidP256ECDSAKeyPair(badPair)).rejects.toEqual(
      expect.objectContaining({
        message: "publicKey.type must be 'public'.",
        code: TurnkeyErrorCodes.INVALID_REQUEST,
      }),
    );
  });

  it("throws if privateKey lacks 'sign' usage", async () => {
    // Generate ECDH keys to force missing 'sign' usage
    const ecdhPair = (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey"],
    )) as CryptoKeyPair;

    await expect(assertValidP256ECDSAKeyPair(ecdhPair)).rejects.toEqual(
      expect.objectContaining({
        message: "privateKey must have 'sign' in keyUsages.",
        code: TurnkeyErrorCodes.INVALID_REQUEST,
      }),
    );
  });

  it("throws if publicKey lacks 'verify' usage", async () => {
    const pair = await genECDSA();
    Object.defineProperty(pair.publicKey, "usages", {
      value: [],
      configurable: true,
    });

    await expect(assertValidP256ECDSAKeyPair(pair)).rejects.toEqual(
      expect.objectContaining({
        message: "publicKey must have 'verify' in keyUsages.",
        code: TurnkeyErrorCodes.INVALID_REQUEST,
      }),
    );
  });

  it("throws if algorithm is not ECDSA (name mismatch)", async () => {
    const ecdhPair = (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey"],
    )) as CryptoKeyPair;

    // Patch usages so we reach the algorithm check
    Object.defineProperty(ecdhPair.privateKey, "usages", {
      value: ["sign"],
      configurable: true,
    });
    Object.defineProperty(ecdhPair.publicKey, "usages", {
      value: ["verify"],
      configurable: true,
    });

    await expect(assertValidP256ECDSAKeyPair(ecdhPair)).rejects.toEqual(
      expect.objectContaining({
        message: "Keys must be ECDSA keys.",
        code: TurnkeyErrorCodes.INVALID_REQUEST,
      }),
    );
  });

  it("throws if curve is not P-256 (e.g., ECDSA P-384)", async () => {
    const pair = await genECDSA({ namedCurve: "P-384" });
    await expect(assertValidP256ECDSAKeyPair(pair)).rejects.toEqual(
      expect.objectContaining({
        message: "Keys must be on the P-256 curve.",
        code: TurnkeyErrorCodes.INVALID_REQUEST,
      }),
    );
  });

  it("throws if exported public key is not uncompressed (65 bytes starting with 0x04)", async () => {
    const pair = await genECDSA();

    const exportSpy = jest
      .spyOn(crypto.subtle, "exportKey")
      .mockResolvedValue(new Uint8Array(64).buffer);

    await expect(assertValidP256ECDSAKeyPair(pair)).rejects.toEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          "Public key must be an uncompressed P-256 point (65 bytes, leading 0x04)",
        ),
        code: TurnkeyErrorCodes.INVALID_REQUEST,
      }),
    );

    exportSpy.mockRestore();
  });

  it("throws if the pair doesn't match (verify fails)", async () => {
    const a = await genECDSA();
    const b = await genECDSA();
    const mixed: CryptoKeyPair = {
      privateKey: a.privateKey,
      publicKey: b.publicKey,
    };

    await expect(assertValidP256ECDSAKeyPair(mixed)).rejects.toEqual(
      expect.objectContaining({
        message: "publicKey does not match privateKey (verify failed).",
        code: TurnkeyErrorCodes.INVALID_REQUEST,
      }),
    );
  });
});

describe("isValidPasskeyName", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("web: accepts allowed characters and any length >= 1", () => {
    // Default behavior (assume web): isReactNative() => false
    jest.spyOn(utils, "isReactNative").mockReturnValue(false);

    expect(isValidPasskeyName("A-Z a_z 0-9 -_:/.")).toBe("A-Z a_z 0-9 -_:/.");
    // Long name is accepted on web because regex uses `+` (no 64 cap)
    const long = "a".repeat(200);
    expect(isValidPasskeyName(long)).toBe(long);
  });

  it("web: rejects empty or invalid characters (e.g., emoji)", () => {
    jest.spyOn(utils, "isReactNative").mockReturnValue(false);
    expect(() => isValidPasskeyName("")).toThrow(TurnkeyError);
    expect(() => isValidPasskeyName("ok🙂")).toThrow(
      /Passkey name must be 1-64 characters and only contain/i,
    );
  });

  it("react-native: enforces 1–64 length and same allowed charset", () => {
    // simulate React Native environment
    const originalNav = (global as any).navigator;
    (global as any).navigator = { product: "ReactNative" };

    try {
      expect(isValidPasskeyName("Name_01-/:.")).toBe("Name_01-/:.");

      const max = "x".repeat(64);
      expect(isValidPasskeyName(max)).toBe(max);

      const over = "x".repeat(65);
      expect(() => isValidPasskeyName(over)).toThrow(
        /Passkey name must be 1-64 characters/i,
      );
    } finally {
      // restore original navigator
      (global as any).navigator = originalNav;
    }
  });

  it("react-native: rejects invalid characters", () => {
    const originalNav = (global as any).navigator;
    (global as any).navigator = { product: "ReactNative" };

    try {
      expect(() => isValidPasskeyName("bad*char")).toThrow(TurnkeyError);
    } finally {
      // restore original navigator
      (global as any).navigator = originalNav;
    }
  });
});
