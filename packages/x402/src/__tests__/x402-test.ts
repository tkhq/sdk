import { describe, expect, test } from "@jest/globals";
import { x402Client } from "@x402/core/client";
import { decodePaymentSignatureHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { createHash } from "node:crypto";
import {
  hashTypedData,
  parseSignature,
  recoverTypedDataAddress,
  verifyTypedData,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createAccountWithAddress } from "@turnkey/viem";
import {
  boundNonce,
  createX402Signer,
  decodePaymentRequiredHeader,
  encodePaymentSignatureHeader,
  signTransferWithAuthorization,
  transferWithAuthorizationTypedData,
  usdMinorToUsdcAtomic,
  x402WalletPolicy,
} from "../index";

// The well-known public test key from the web3.js documentation; it holds no funds.
const account = privateKeyToAccount(
  "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318",
);
const usdcBaseSepolia = {
  address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  chainId: 84532,
  name: "USDC",
  version: "2",
} as const;
const payTo = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const nonce =
  "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480";

// Examples from coinbase/x402 specs/transports-v2/http.md at commit
// 0e6e8c55d86b4f14234fb6e49a4052074fb93e57.
const specPaymentRequiredHeader =
  "eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQQVlNRU5ULVNJR05BVFVSRSBoZWFkZXIgaXMgcmVxdWlyZWQiLCJyZXNvdXJjZSI6eyJ1cmwiOiJodHRwczovL2FwaS5leGFtcGxlLmNvbS9wcmVtaXVtLWRhdGEiLCJkZXNjcmlwdGlvbiI6IkFjY2VzcyB0byBwcmVtaXVtIG1hcmtldCBkYXRhIiwibWltZVR5cGUiOiJhcHBsaWNhdGlvbi9qc29uIn0sImFjY2VwdHMiOlt7InNjaGVtZSI6ImV4YWN0IiwibmV0d29yayI6ImVpcDE1NTo4NDUzMiIsImFtb3VudCI6IjEwMDAwIiwiYXNzZXQiOiIweDAzNkNiRDUzODQyYzU0MjY2MzRlNzkyOTU0MWVDMjMxOGYzZENGN2UiLCJwYXlUbyI6IjB4MjA5NjkzQmM2YWZjMEM1MzI4YkEzNkZhRjAzQzUxNEVGMzEyMjg3QyIsIm1heFRpbWVvdXRTZWNvbmRzIjo2MCwiZXh0cmEiOnsibmFtZSI6IlVTREMiLCJ2ZXJzaW9uIjoiMiJ9fV19";
const specPaymentRequirements = {
  scheme: "exact",
  network: "eip155:84532" as const,
  amount: "10000",
  asset: usdcBaseSepolia.address,
  payTo,
  maxTimeoutSeconds: 60,
  extra: { name: "USDC", version: "2" },
};
const specResource = {
  url: "https://api.example.com/premium-data",
  description: "Access to premium market data",
  mimeType: "application/json",
};
const specPaymentSignatureHeader =
  "eyJ4NDAyVmVyc2lvbiI6MiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20vcHJlbWl1bS1kYXRhIiwiZGVzY3JpcHRpb24iOiJBY2Nlc3MgdG8gcHJlbWl1bSBtYXJrZXQgZGF0YSIsIm1pbWVUeXBlIjoiYXBwbGljYXRpb24vanNvbiJ9LCJhY2NlcHRlZCI6eyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJlaXAxNTU6ODQ1MzIiLCJhbW91bnQiOiIxMDAwMCIsImFzc2V0IjoiMHgwMzZDYkQ1Mzg0MmM1NDI2NjM0ZTc5Mjk1NDFlQzIzMThmM2RDRjdlIiwicGF5VG8iOiIweDIwOTY5M0JjNmFmYzBDNTMyOGJBMzZGYUYwM0M1MTRFRjMxMjI4N0MiLCJtYXhUaW1lb3V0U2Vjb25kcyI6NjAsImV4dHJhIjp7Im5hbWUiOiJVU0RDIiwidmVyc2lvbiI6IjIifX0sInBheWxvYWQiOnsic2lnbmF0dXJlIjoiMHgyZDZhNzU4OGQ2YWNjYTUwNWNiZjBkOWE0YTIyN2UwYzUyYzZjMzQwMDhjOGU4OTg2YTEyODMyNTk3NjQxNzM2MDhhMmNlNjQ5NjY0MmUzNzdkNmRhOGRiYmY1ODM2ZTliZDE1MDkyZjllY2FiMDVkZWQzZDYyOTNhZjE0OGI1NzFjIiwiYXV0aG9yaXphdGlvbiI6eyJmcm9tIjoiMHg4NTdiMDY1MTlFOTFlM0E1NDUzODc5MWJEYmIwRTIyMzczZTM2YjY2IiwidG8iOiIweDIwOTY5M0JjNmFmYzBDNTMyOGJBMzZGYUYwM0M1MTRFRjMxMjI4N0MiLCJ2YWx1ZSI6IjEwMDAwIiwidmFsaWRBZnRlciI6IjE3NDA2NzIwODkiLCJ2YWxpZEJlZm9yZSI6IjE3NDA2NzIxNTQiLCJub25jZSI6IjB4ZjM3NDY2MTNjMmQ5MjBiNWZkYWJjMDg1NmYyYWViMmQ0Zjg4ZWU2MDM3YjhjYzVkMDRhNzFhNDQ2MmYxMzQ4MCJ9fX0=";
const specPaymentPayload = {
  x402Version: 2,
  resource: specResource,
  accepted: specPaymentRequirements,
  payload: {
    signature:
      "0x2d6a7588d6acca505cbf0d9a4a227e0c52c6c34008c8e8986a1283259764173608a2ce6496642e377d6da8dbbf5836e9bd15092f9ecab05ded3d6293af148b571c",
    authorization: {
      from: "0x857b06519E91e3A54538791bDbb0E22373e36b66",
      to: payTo,
      value: "10000",
      validAfter: "1740672089",
      validBefore: "1740672154",
      nonce,
    },
  },
};

const transfer = {
  token: usdcBaseSepolia,
  from: account.address,
  to: payTo,
  value: 10_000n,
  validAfter: 1740672089n,
  validBefore: 1740672154n,
  nonce,
} as const;

const handWrittenTypedData = {
  domain: {
    name: "USDC",
    version: "2",
    chainId: 84532,
    verifyingContract: usdcBaseSepolia.address,
  },
  types: {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  },
  primaryType: "TransferWithAuthorization",
  message: {
    from: account.address,
    to: payTo,
    value: 10_000n,
    validAfter: 1740672089n,
    validBefore: 1740672154n,
    nonce,
  },
} as const;

describe("EIP-3009 typed data", () => {
  test("matches the hand-written TransferWithAuthorization typed data and its digest", () => {
    const typedData = transferWithAuthorizationTypedData(transfer);
    expect(typedData).toEqual(handWrittenTypedData);
    expect(hashTypedData(typedData)).toBe(hashTypedData(handWrittenTypedData));
  });

  test("returns a signature that recovers to the signing account and the digest it signed", async () => {
    const typedData = transferWithAuthorizationTypedData(transfer);
    const { signature, digest } = await signTransferWithAuthorization(
      account,
      typedData,
    );
    expect(digest).toBe(hashTypedData(handWrittenTypedData));
    expect(
      await recoverTypedDataAddress({ ...handWrittenTypedData, signature }),
    ).toBe(account.address);
  });
});

function stubTurnkeyAccount() {
  const sent: { encoding: string; typedData: any }[] = [];
  const client = {
    signRawPayload: async (params: { payload: string; encoding: string }) => {
      const typedData = JSON.parse(params.payload);
      sent.push({ encoding: params.encoding, typedData });
      const { r, s, yParity } = parseSignature(
        await account.sign({ hash: hashTypedData(typedData) }),
      );
      return {
        activity: { id: "activity-id", status: "ACTIVITY_STATUS_COMPLETED" },
        r: r.slice(2),
        s: s.slice(2),
        v: String(yParity),
      };
    },
  };
  const turnkeyAccount = createAccountWithAddress({
    client: client as any,
    organizationId: "organization-id",
    signWith: account.address,
  });
  return { turnkeyAccount, sent };
}

describe("signing through a @turnkey/viem account", () => {
  const expectedDomain = {
    name: "USDC",
    version: "2",
    chainId: 84532,
    verifyingContract: usdcBaseSepolia.address.toLowerCase(),
  };

  test("sends the token's EIP-712 domain to Turnkey and gets a signature over it", async () => {
    const { turnkeyAccount, sent } = stubTurnkeyAccount();
    const { signature } = await signTransferWithAuthorization(
      turnkeyAccount,
      transferWithAuthorizationTypedData(transfer),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]!.encoding).toBe("PAYLOAD_ENCODING_EIP712");
    expect(sent[0]!.typedData.domain).toEqual(expectedDomain);
    expect(
      await verifyTypedData({
        ...handWrittenTypedData,
        address: account.address,
        signature,
      }),
    ).toBe(true);
  });

  test("sends the token's EIP-712 domain when the x402 client signs through createX402Signer", async () => {
    const { turnkeyAccount, sent } = stubTurnkeyAccount();
    const scheme = new ExactEvmScheme(createX402Signer(turnkeyAccount));
    await scheme.createPaymentPayload(2, specPaymentRequirements);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.encoding).toBe("PAYLOAD_ENCODING_EIP712");
    expect(sent[0]!.typedData.domain).toEqual(expectedDomain);
  });
});

describe("x402 HTTP headers", () => {
  test("decodes the spec's PAYMENT-REQUIRED example", () => {
    expect(decodePaymentRequiredHeader(specPaymentRequiredHeader)).toEqual({
      x402Version: 2,
      error: "PAYMENT-SIGNATURE header is required",
      resource: specResource,
      accepts: [specPaymentRequirements],
    });
  });

  test("encodes the spec's payment payload as the spec's PAYMENT-SIGNATURE example", () => {
    expect(encodePaymentSignatureHeader(specPaymentPayload)).toBe(
      specPaymentSignatureHeader,
    );
  });
});

describe("x402 client with a viem account signer", () => {
  test("pays a 402 response with a payment the payer's address signed", async () => {
    const requests: Request[] = [];
    const stubFetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const request = new Request(input, init);
      requests.push(request);
      if (!request.headers.has("PAYMENT-SIGNATURE")) {
        return new Response("{}", {
          status: 402,
          headers: { "PAYMENT-REQUIRED": specPaymentRequiredHeader },
        });
      }
      return new Response("paid", { status: 200 });
    };
    const client = new x402Client().register(
      "eip155:84532",
      new ExactEvmScheme(createX402Signer(account)),
    );

    const response = await wrapFetchWithPayment(
      stubFetch,
      client,
    )(specResource.url);

    expect(await response.text()).toBe("paid");
    expect(requests).toHaveLength(2);
    const { payload } = decodePaymentSignatureHeader(
      requests[1]!.headers.get("PAYMENT-SIGNATURE")!,
    );
    const authorization = payload["authorization"] as Record<string, Hex>;
    expect(authorization).toMatchObject({
      from: account.address,
      to: payTo,
      value: "10000",
    });
    const typedData = transferWithAuthorizationTypedData({
      token: usdcBaseSepolia,
      from: authorization["from"]!,
      to: authorization["to"]!,
      value: BigInt(authorization["value"]!),
      validAfter: BigInt(authorization["validAfter"]!),
      validBefore: BigInt(authorization["validBefore"]!),
      nonce: authorization["nonce"]!,
    });
    expect(
      await verifyTypedData({
        ...typedData,
        address: account.address,
        signature: payload["signature"] as Hex,
      }),
    ).toBe(true);
  });
});

describe("usdMinorToUsdcAtomic", () => {
  test.each([
    [0, 0n],
    [1, 10_000n],
    [150, 1_500_000n],
    [12_345_678_901n, 123_456_789_010_000n],
  ])("converts %p cents to %p atomic USDC", (cents, atomic) => {
    expect(usdMinorToUsdcAtomic(cents)).toBe(atomic);
  });

  test.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects %p cents",
    (cents) => {
      expect(() => usdMinorToUsdcAtomic(cents)).toThrow(RangeError);
    },
  );
});

describe("boundNonce", () => {
  test("hashes the RFC 8785 canonical JSON of the binding, whatever the key order", () => {
    const canonical = '{"amount":"10000","order":"a\\"1","é":"x"}';
    const expected = `0x${createHash("sha256").update(canonical).digest("hex")}`;
    expect(boundNonce({ é: "x", order: 'a"1', amount: "10000" })).toBe(
      expected,
    );
    expect(boundNonce({ amount: "10000", order: 'a"1', é: "x" })).toBe(
      expected,
    );
    expect(expected).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test.each([{ a: { z: "1" } }, { a: undefined }, { a: 1 }])(
    "rejects a binding with a non-string value: %p",
    (binding) => {
      expect(() => boundNonce(binding as any)).toThrow(TypeError);
    },
  );
});

describe("x402WalletPolicy", () => {
  const base = {
    walletId: "0b1e6a54-3c1f-4a5e-9d2b-7f8e1c2d3a4b",
    chainId: 84532,
    token: usdcBaseSepolia.address,
    payer: "0x857b06519E91e3A54538791bDbb0E22373e36b66",
    capAtomic: 5_000_000n,
  } as const;
  const condition =
    "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2' && " +
    "activity.params.encoding == 'PAYLOAD_ENCODING_EIP712' && " +
    "wallet.id == '0b1e6a54-3c1f-4a5e-9d2b-7f8e1c2d3a4b' && " +
    "eth.eip_712.primary_type == 'TransferWithAuthorization' && " +
    "eth.eip_712.domain.chain_id == 84532 && " +
    "eth.eip_712.domain.verifying_contract == '0x036cbd53842c5426634e7929541ec2318f3dcf7e' && " +
    "eth.eip_712.typed_message['from'] == '0x857b06519e91e3a54538791bdbb0e22373e36b66' && " +
    "eth.eip_712.typed_message['value'] <= 5000000";

  test("allows only capped TransferWithAuthorization typed data from the payer", () => {
    expect(JSON.stringify(x402WalletPolicy(base))).toBe(
      JSON.stringify({ effect: "EFFECT_ALLOW", condition }),
    );
  });

  test("requires the approver credential and the co-approver when given", () => {
    const policy = x402WalletPolicy({
      ...base,
      approverCredentialId: "5c6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e8f",
      coApproverUserId: "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a",
    });
    expect(JSON.stringify(policy)).toBe(
      JSON.stringify({
        effect: "EFFECT_ALLOW",
        condition,
        consensus:
          "credentials.any(credential, credential.id == '5c6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e8f') && " +
          "approvers.any(user, user.id == '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a')",
      }),
    );
  });

  test.each([
    { walletId: "x' || true || '" },
    { walletId: 'w" \n|| true' },
    { walletId: "" },
    { payer: "0x857b' || true || '" },
    { capAtomic: -1n },
    { capAtomic: 2n ** 256n },
    { capAtomic: "1 || true" },
    { capAtomic: 1e21 },
    { approverCredentialId: "" },
    { coApproverUserId: "" },
    { coApproverUserId: "u' || true || '" },
  ])("rejects %p, which would inject into or loosen the policy", (override) => {
    expect(() => x402WalletPolicy({ ...base, ...override } as any)).toThrow();
  });
});
