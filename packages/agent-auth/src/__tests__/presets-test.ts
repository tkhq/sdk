import { gitSigning, jwtSigning, ethSigning } from "../presets";

describe("presets", () => {
  describe("gitSigning", () => {
    it("returns Ed25519 account config with defaults", () => {
      const config = gitSigning();
      expect(config.label).toBe("git-signing");
      expect(config.curve).toBe("CURVE_ED25519");
      expect(config.pathFormat).toBe("PATH_FORMAT_BIP32");
      expect(config.addressFormat).toBe("ADDRESS_FORMAT_SOLANA");
      expect(config.exportKey).toBe(false);
    });

    it("supports exportKey option", () => {
      const config = gitSigning({ exportKey: true });
      expect(config.exportKey).toBe(true);
      expect(config.curve).toBe("CURVE_ED25519");
    });

    it("supports custom path", () => {
      const config = gitSigning({ path: "m/44'/1'/99'/0/0" });
      expect(config.path).toBe("m/44'/1'/99'/0/0");
    });
  });

  describe("jwtSigning", () => {
    it("returns P256 account config with defaults", () => {
      const config = jwtSigning();
      expect(config.label).toBe("jwt-signing");
      expect(config.curve).toBe("CURVE_P256");
      expect(config.pathFormat).toBe("PATH_FORMAT_BIP32");
      expect(config.addressFormat).toBe("ADDRESS_FORMAT_COMPRESSED");
      expect(config.exportKey).toBe(false);
    });

    it("supports exportKey option", () => {
      const config = jwtSigning({ exportKey: true });
      expect(config.exportKey).toBe(true);
    });
  });

  describe("ethSigning", () => {
    it("returns secp256k1 account config with defaults", () => {
      const config = ethSigning();
      expect(config.label).toBe("eth-signing");
      expect(config.curve).toBe("CURVE_SECP256K1");
      expect(config.pathFormat).toBe("PATH_FORMAT_BIP32");
      expect(config.path).toBe("m/44'/60'/0'/0/0");
      expect(config.addressFormat).toBe("ADDRESS_FORMAT_ETHEREUM");
      expect(config.exportKey).toBe(false);
    });
  });
});
