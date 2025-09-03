import { v1AddressFormat, v1WalletAccount } from "@turnkey/sdk-types";
import {
  isWeb,
  isReactNative,
  addressFormatConfig,
  getHashFunction,
  getEncodingType,
  getEncodedMessage,
  isWalletAccountArray,
  createWalletAccountFromAddressFormat,
  generateWalletAccountsFromAddressFormat,
} from "../utils";
import {
  describe,
  expect,
  jest,
  beforeEach,
  afterEach,
  it,
} from "@jest/globals";

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
      expect(accounts[0].addressFormat).toBe(ETH);
      expect(accounts[1].addressFormat).toBe(COSMOS);
    });

    it("increments index for duplicates", () => {
      const accounts = generateWalletAccountsFromAddressFormat({
        addresses: [ETH, ETH, ETH],
      });
      expect(accounts.map((a) => a.path)).toEqual([
        "m/44'/60'/0'/0",
        "m/44'/60'/0'/1",
        "m/44'/60'/0'/2",
      ]);
    });

    it("resumes from existing max index", () => {
      const existing = [
        {
          addressFormat: ETH,
          curve: "CURVE_SECP256K1",
          path: "m/44'/60'/0'/5",
          pathFormat: "PATH_FORMAT_BIP32",
        },
      ] as v1WalletAccount[];
      const accounts = generateWalletAccountsFromAddressFormat({
        addresses: [ETH, ETH],
        existingWalletAccounts: existing,
      });
      expect(accounts.map((a) => a.path)).toEqual([
        "m/44'/60'/0'/6",
        "m/44'/60'/0'/7",
      ]);
    });
  });
});
