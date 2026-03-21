import {
  allowSignRawPayloads,
  allowAllSigning,
  allowEthTransaction,
  allowErc20Transfer,
  allowEip712Signing,
  allowSolTransfer,
  allowSplTransfer,
  allowExportWalletAccount,
  allowCreateWalletAccounts,
  combineConditions,
} from "../policy-templates";

describe("signing templates", () => {
  it("allowSignRawPayloads returns correct policy", () => {
    const policy = allowSignRawPayloads();
    expect(policy.effect).toBe("EFFECT_ALLOW");
    expect(policy.condition).toBe(
      "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOADS'",
    );
    expect(policy.consensus).toContain("<AGENT_USER_ID>");
  });

  it("allowAllSigning uses in operator with all signing types", () => {
    const policy = allowAllSigning();
    expect(policy.effect).toBe("EFFECT_ALLOW");
    expect(policy.condition).toContain("activity.type in [");
    expect(policy.condition).toContain("ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2");
    expect(policy.condition).toContain("ACTIVITY_TYPE_SIGN_TRANSACTION_V2");
    expect(policy.condition).toContain("ACTIVITY_TYPE_SIGN_RAW_PAYLOADS");
    // Uses `in` not `||`
    expect(policy.condition).not.toContain("||");
  });
});

describe("ethereum templates", () => {
  describe("allowEthTransaction", () => {
    it("default (no options) checks only activity type", () => {
      const policy = allowEthTransaction();
      expect(policy.effect).toBe("EFFECT_ALLOW");
      expect(policy.condition).toBe(
        "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'",
      );
      expect(policy.consensus).toContain("<AGENT_USER_ID>");
    });

    it("with chainIds adds chain restriction", () => {
      const policy = allowEthTransaction({ chainIds: [1, 137] });
      expect(policy.condition).toContain("eth.tx.chain_id in [1, 137]");
    });

    it("with maxValue adds value cap", () => {
      const policy = allowEthTransaction({
        maxValue: "1000000000000000000",
      });
      expect(policy.condition).toContain("eth.tx.value <= 1000000000000000000");
    });

    it("with maxValue zero is valid", () => {
      const policy = allowEthTransaction({ maxValue: "0" });
      expect(policy.condition).toContain("eth.tx.value <= 0");
    });

    it("with allowedAddresses lowercases and uses in operator", () => {
      const policy = allowEthTransaction({
        allowedAddresses: ["0xAbC123", "0xDeF456"],
      });
      expect(policy.condition).toContain(
        "eth.tx.to in ['0xabc123', '0xdef456']",
      );
    });

    it("with walletId adds wallet restriction", () => {
      const policy = allowEthTransaction({ walletId: "wallet-uuid" });
      expect(policy.condition).toContain("wallet.id == 'wallet-uuid'");
    });

    it("with all options combines with &&", () => {
      const policy = allowEthTransaction({
        chainIds: [1],
        maxValue: "1000",
        allowedAddresses: ["0xabc"],
        walletId: "w1",
      });
      const parts = policy.condition!.split(" && ");
      expect(parts).toHaveLength(5); // activity type + 4 restrictions
    });
  });

  describe("allowErc20Transfer", () => {
    it("checks token address and function selector", () => {
      const policy = allowErc20Transfer({
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      });
      expect(policy.condition).toContain(
        "eth.tx.to == '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'",
      );
      expect(policy.condition).toContain("eth.tx.data[0..10] == '0xa9059cbb'");
    });

    it("with allowedRecipients adds contract_call_args check", () => {
      const policy = allowErc20Transfer({
        tokenAddress: "0xtoken",
        allowedRecipients: ["0xRecipient1"],
      });
      expect(policy.condition).toContain(
        "eth.tx.contract_call_args['to'] in ['0xrecipient1']",
      );
    });

    it("with chainIds adds chain restriction", () => {
      const policy = allowErc20Transfer({
        tokenAddress: "0xtoken",
        chainIds: [1],
      });
      expect(policy.condition).toContain("eth.tx.chain_id in [1]");
    });
  });

  describe("allowEip712Signing", () => {
    it("default checks only activity type", () => {
      const policy = allowEip712Signing();
      expect(policy.condition).toBe(
        "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'",
      );
    });

    it("with domainName restricts domain", () => {
      const policy = allowEip712Signing({ domainName: "Uniswap" });
      expect(policy.condition).toContain(
        "eth.eip_712.domain.name == 'Uniswap'",
      );
    });

    it("with primaryType restricts type", () => {
      const policy = allowEip712Signing({ primaryType: "Order" });
      expect(policy.condition).toContain("eth.eip_712.primary_type == 'Order'");
    });
  });
});

describe("solana templates", () => {
  describe("allowSolTransfer", () => {
    it("default checks only activity type", () => {
      const policy = allowSolTransfer();
      expect(policy.condition).toBe(
        "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'",
      );
    });

    it("with allowedRecipients restricts destinations", () => {
      const policy = allowSolTransfer({
        allowedRecipients: ["SolAddr1", "SolAddr2"],
      });
      expect(policy.condition).toContain(
        "solana.tx.transfers.all(t, t.to in ['SolAddr1', 'SolAddr2'])",
      );
      // Solana addresses are case-sensitive (not lowercased)
      expect(policy.condition).toContain("SolAddr1");
    });
  });

  describe("allowSplTransfer", () => {
    it("default checks only activity type", () => {
      const policy = allowSplTransfer();
      expect(policy.condition).toBe(
        "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'",
      );
    });

    it("with tokenMint restricts token", () => {
      const policy = allowSplTransfer({ tokenMint: "TokenMintAddr" });
      expect(policy.condition).toContain(
        "solana.tx.spl_transfers.all(t, t.token_mint == 'TokenMintAddr')",
      );
    });

    it("with allowedRecipients restricts destinations", () => {
      const policy = allowSplTransfer({
        allowedRecipients: ["Recipient1"],
      });
      expect(policy.condition).toContain(
        "solana.tx.spl_transfers.all(t, t.to in ['Recipient1'])",
      );
    });
  });
});

describe("wallet templates", () => {
  it("allowExportWalletAccount returns correct policy", () => {
    const policy = allowExportWalletAccount();
    expect(policy.effect).toBe("EFFECT_ALLOW");
    expect(policy.condition).toBe(
      "activity.type == 'ACTIVITY_TYPE_EXPORT_WALLET_ACCOUNT'",
    );
  });

  it("allowCreateWalletAccounts returns correct policy", () => {
    const policy = allowCreateWalletAccounts();
    expect(policy.effect).toBe("EFFECT_ALLOW");
    expect(policy.condition).toBe(
      "activity.type == 'ACTIVITY_TYPE_CREATE_WALLET_ACCOUNTS'",
    );
  });
});

describe("utility", () => {
  it("combineConditions joins with &&", () => {
    const result = combineConditions(["a == 1", "b == 2", "c == 3"]);
    expect(result).toBe("a == 1 && b == 2 && c == 3");
  });

  it("combineConditions with single condition returns it as-is", () => {
    const result = combineConditions(["a == 1"]);
    expect(result).toBe("a == 1");
  });

  it("combineConditions throws on empty array", () => {
    expect(() => combineConditions([])).toThrow(
      "combineConditions requires at least one condition",
    );
  });
});

describe("all templates use EFFECT_ALLOW and AGENT_USER_ID placeholder", () => {
  const allTemplates = [
    allowSignRawPayloads(),
    allowAllSigning(),
    allowEthTransaction(),
    allowErc20Transfer({ tokenAddress: "0x0" }),
    allowEip712Signing(),
    allowSolTransfer(),
    allowSplTransfer(),
    allowExportWalletAccount(),
    allowCreateWalletAccounts(),
  ];

  it.each(allTemplates.map((t) => [t.policyName, t]))(
    "%s uses EFFECT_ALLOW",
    (_name, template) => {
      expect((template as any).effect).toBe("EFFECT_ALLOW");
    },
  );

  it.each(allTemplates.map((t) => [t.policyName, t]))(
    "%s uses AGENT_USER_ID placeholder in consensus",
    (_name, template) => {
      expect((template as any).consensus).toContain("<AGENT_USER_ID>");
    },
  );
});
