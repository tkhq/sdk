import {
  defaultSigningPolicy,
  signTransactionPolicy,
  resolvePolicyPlaceholders,
} from "../policies";

describe("policies", () => {
  describe("defaultSigningPolicy", () => {
    it("creates an ALLOW policy for sign_raw_payload scoped to agent user", () => {
      const policy = defaultSigningPolicy("usr_abc123");
      expect(policy.policyName).toBe("allow-sign-raw-payload");
      expect(policy.effect).toBe("EFFECT_ALLOW");
      expect(policy.condition).toBe(
        "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'"
      );
      expect(policy.consensus).toContain("usr_abc123");
    });

    it("uses approvers.any pattern in consensus", () => {
      const policy = defaultSigningPolicy("usr_xyz");
      expect(policy.consensus).toBe(
        "approvers.any(user, user.id == 'usr_xyz')"
      );
    });
  });

  describe("signTransactionPolicy", () => {
    it("creates an ALLOW policy for sign_transaction", () => {
      const policy = signTransactionPolicy("usr_abc123");
      expect(policy.policyName).toBe("allow-sign-transaction");
      expect(policy.effect).toBe("EFFECT_ALLOW");
      expect(policy.condition).toBe(
        "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'"
      );
      expect(policy.consensus).toContain("usr_abc123");
    });
  });

  describe("resolvePolicyPlaceholders", () => {
    it("replaces <AGENT_USER_ID> with actual user ID", () => {
      const policies = [
        {
          policyName: "test",
          effect: "EFFECT_ALLOW",
          condition: "true",
          consensus: "approvers.any(user, user.id == '<AGENT_USER_ID>')",
        },
      ];

      const resolved = resolvePolicyPlaceholders(policies, "usr_real_id");
      expect(resolved[0]!.consensus).toBe(
        "approvers.any(user, user.id == 'usr_real_id')"
      );
    });

    it("handles multiple placeholders in one consensus", () => {
      const policies = [
        {
          policyName: "test",
          effect: "EFFECT_ALLOW",
          consensus:
            "approvers.any(user, user.id == '<AGENT_USER_ID>') && activity.resource.userId == '<AGENT_USER_ID>'",
        },
      ];

      const resolved = resolvePolicyPlaceholders(policies, "usr_123");
      expect(resolved[0]!.consensus).not.toContain("<AGENT_USER_ID>");
      expect(resolved[0]!.consensus).toContain("usr_123");
    });

    it("leaves policies without consensus unchanged", () => {
      const policies = [
        {
          policyName: "test",
          effect: "EFFECT_ALLOW",
          condition: "true",
        },
      ];

      const resolved = resolvePolicyPlaceholders(policies, "usr_123");
      expect(resolved[0]!.consensus).toBeUndefined();
    });

    it("returns empty array for empty input", () => {
      const resolved = resolvePolicyPlaceholders([], "usr_123");
      expect(resolved).toEqual([]);
    });
  });
});
