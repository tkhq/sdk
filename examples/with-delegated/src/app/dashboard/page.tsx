"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useTurnkey,
  AuthState,
  WalletSource,
  type Wallet,
  type WalletAccount,
} from "@turnkey/react-wallet-kit";

import { serializeTransaction, parseGwei } from "viem";
import { validatePolicyAction } from "@/server/actions/validatePolicy";

type AccountsBlock = {
  walletId: string;
  walletName: string;
  accounts: WalletAccount[];
};

// Build a raw unsigned legacy Ethereum tx
function buildUnsignedLegacyRaw({
  chainId = 1,
  nonce = 0,
  gas = BigInt(21000),
  gasPriceGwei = 1,
  to,
  value = BigInt(0),
}: {
  chainId?: number;
  nonce?: number;
  gas?: bigint;
  gasPriceGwei?: number;
  to: `0x${string}` | string;
  value?: bigint;
}) {
  const tx = {
    chainId,
    nonce,
    to: to as `0x${string}`,
    gas,
    gasPrice: parseGwei(String(gasPriceGwei)),
    value,
    data: "0x" as `0x${string}`,
    type: "legacy" as const,
  };

  return serializeTransaction(tx);
}

export default function Dashboard() {
  const {
    authState,
    user,
    session,
    logout,
    fetchOrCreateP256ApiKeyUser,
    fetchOrCreatePolicies,
    wallets,
    httpClient,
  } = useTurnkey();

  const router = useRouter();

  const [daUser, setDaUser] = useState<any | null>(null);

  // Public key input (default to .env)
  const [daPublicKey, setDaPublicKey] = useState<string>(
    process.env.NEXT_PUBLIC_DA_PUBLIC_KEY || "",
  );
  const [publicKeyErr, setPublicKeyErr] = useState<string | null>(null);

  // Policy state — prefill recipient from .env
  const [recipientAddress, setRecipientAddress] = useState<string>(
    process.env.NEXT_PUBLIC_RECIPIENT_ADDRESS || "",
  );
  const [recipientErr, setRecipientErr] = useState<string | null>(null);
  const [policyJson, setPolicyJson] = useState<string>("[]");
  const [policyResult, setPolicyResult] = useState<any | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [submittingPolicy, setSubmittingPolicy] = useState(false);

  // Validation demo state (recipients -> unsigned raw hex)
  const [signWithAddress, setSignWithAddress] = useState<string>("");
  const [toAllowed, setToAllowed] = useState<string>(recipientAddress);
  const [toDenied, setToDenied] = useState<string>("");

  const [unsignedAllowHex, setUnsignedAllowHex] = useState<string>("");
  const [unsignedDenyHex, setUnsignedDenyHex] = useState<string>("");

  const [valResult, setValResult] = useState<any | null>(null);
  const [valLoading, setValLoading] = useState(false);
  const [valError, setValError] = useState<string | null>(null);

  // Live Sub-Org State
  const [orgUsers, setOrgUsers] = useState<any[] | null>(null);
  const [orgPolicies, setOrgPolicies] = useState<any[] | null>(null);
  const [orgRootQuorum, setOrgRootQuorum] = useState<any | null>(null);
  const [orgMetaLoading, setOrgMetaLoading] = useState(false);
  const [orgMetaError, setOrgMetaError] = useState<string | null>(null);

  useEffect(() => {
    if (authState === AuthState.Unauthenticated) {
      router.replace("/");
    }
  }, [authState, router]);

  // Wallet accounts
  const accountsData = useMemo(() => {
    const list = (wallets ?? []).filter(
      (w: Wallet) => w.source === WalletSource.Embedded,
    );
    return list.map((w: Wallet) => ({
      walletId: w.walletId,
      walletName: w.walletName,
      accounts: (w as any).accounts ?? [],
    })) as AccountsBlock[];
  }, [wallets]);

  // Auto-pick first embedded EVM account address for `signWith`
  const firstEmbeddedAddress = useMemo(() => {
    const a = accountsData?.[0]?.accounts?.[0];
    return (a as any)?.address || "";
  }, [accountsData]);

  useEffect(() => {
    if (!signWithAddress && firstEmbeddedAddress) {
      setSignWithAddress(firstEmbeddedAddress);
    }
  }, [firstEmbeddedAddress, signWithAddress]);

  const isEthAddress = (addr: string) =>
    /^0x[a-fA-F0-9]{40}$/.test(addr.trim());

  const isHexCompressedPubKey = (key: string) =>
    /^[0-9a-fA-F]{66}$/.test(key.trim());

  // Delegated Access setup
  const handleDaSetup = async () => {
    if (!isHexCompressedPubKey(daPublicKey)) {
      setPublicKeyErr(
        "Public key must be a 66-hex-character compressed key (no 0x prefix).",
      );
      return;
    }
    setPublicKeyErr(null);

    try {
      const res = await fetchOrCreateP256ApiKeyUser({
        publicKey: daPublicKey,
        createParams: {
          userName: "Delegated Access",
          apiKeyName: "Delegated User API Key",
        },
      });
      setDaUser(res);
    } catch (err) {
      console.error("Error setting up DA user:", err);
      setDaUser({ error: "Failed to set up DA user." });
    }
  };

  // Build policy JSON from current DA user + recipient address
  const handleBuildPolicyTemplate = () => {
    if (!daUser?.userId) {
      setPolicyError("Set up the Delegated Access user first.");
      return;
    }
    if (!isEthAddress(recipientAddress)) {
      setRecipientErr("Enter a valid 0x-prefixed, 40-hex Ethereum address.");
      return;
    }
    setRecipientErr(null);
    setPolicyError(null);

    const template = [
      {
        policyName: `Allow user ${daUser.userId} to sign only to ${recipientAddress}`,
        effect: "EFFECT_ALLOW",
        consensus: `approvers.any(user, user.id == '${daUser.userId}')`,
        condition: `eth.tx.to == '${recipientAddress}'`,
        notes:
          "Allow Delegated Access user to sign Ethereum transactions only to the specified recipient",
      },
    ];
    setPolicyJson(JSON.stringify(template, null, 2));
  };

  // Keep in sync setToAllowed if recipientAddress changes manually
  useEffect(() => {
    if (recipientAddress) {
      setToAllowed(recipientAddress);
    }
  }, [recipientAddress]);

  const handleSubmitPolicies = async () => {
    setPolicyError(null);
    setPolicyResult(null);
    setSubmittingPolicy(true);
    try {
      const parsed = JSON.parse(policyJson);
      if (!Array.isArray(parsed)) {
        throw new Error("JSON must be an array of policy objects.");
      }
      const res = await fetchOrCreatePolicies({ policies: parsed });
      setPolicyResult(res);
    } catch (e: any) {
      setPolicyError(e?.message || "Failed to submit policies.");
    } finally {
      setSubmittingPolicy(false);
    }
  };

  // Generate raw unsigned hex whenever the "to" fields change
  useEffect(() => {
    if (isEthAddress(toAllowed)) {
      setUnsignedAllowHex(
        buildUnsignedLegacyRaw({
          to: toAllowed.trim(),
          chainId: 1,
          nonce: 0,
          gas: BigInt(21000),
          gasPriceGwei: 1,
          value: BigInt(0),
        }),
      );
    } else {
      setUnsignedAllowHex("");
    }
  }, [toAllowed]);

  useEffect(() => {
    if (isEthAddress(toDenied)) {
      setUnsignedDenyHex(
        buildUnsignedLegacyRaw({
          to: toDenied.trim(),
          chainId: 1,
          nonce: 0,
          gas: BigInt(21000),
          gasPriceGwei: 1,
          value: BigInt(0),
        }),
      );
    } else {
      setUnsignedDenyHex("");
    }
  }, [toDenied]);

  // Run the policy validation
  async function runValidationDemo() {
    setValLoading(true);
    setValError(null);
    setValResult(null);
    try {
      const subOrgId = session?.organizationId!;
      if (!isEthAddress(signWithAddress)) {
        throw new Error(
          "The signer address must be a valid 0x-prefixed, 40-hex Ethereum address.",
        );
      }
      if (!unsignedAllowHex || !unsignedDenyHex) {
        throw new Error(
          "Fill both Tx To fields with valid 0x addresses to generate raw unsigned tx.",
        );
      }

      const res = await validatePolicyAction(subOrgId, signWithAddress, [
        { label: "Policy Tx Allowed", unsignedTx: unsignedAllowHex },
        { label: "Policy Tx Denied", unsignedTx: unsignedDenyHex },
      ]);
      setValResult(res);
    } catch (e: any) {
      setValError(e?.message || "Validation failed");
    } finally {
      setValLoading(false);
    }
  }

  // Load users, rootQuorum and policies via httpClient
  useEffect(() => {
    const loadOrgMeta = async () => {
      if (authState !== AuthState.Authenticated) return;
      if (!session?.organizationId) return;
      if (!httpClient) return;

      try {
        setOrgMetaLoading(true);
        setOrgMetaError(null);

        const { organizationData } = await httpClient.getOrganization({
          organizationId: session.organizationId,
        });

        setOrgUsers(organizationData?.users ?? []);
        setOrgPolicies(organizationData?.policies ?? []);
        setOrgRootQuorum(organizationData?.rootQuorum ?? null);
      } catch (e: any) {
        setOrgMetaError(e?.message ?? "Failed to load sub-organization data.");
      } finally {
        setOrgMetaLoading(false);
      }
    };

    loadOrgMeta();
  }, [authState, session?.organizationId, httpClient, daUser, policyResult]);

  if (authState !== AuthState.Authenticated) {
    return <p>Loading...</p>;
  }

  return (
    <main className="relative min-h-screen p-4 sm:p-6">
      {/* Logout button */}
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push("/");
        }}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 rounded bg-red-600 px-3 py-1.5 sm:px-4 sm:py-2 text-white text-xs sm:text-sm hover:bg-red-700"
      >
        Log out
      </button>

      <div className="mt-12 mx-auto max-w-screen-xl xl:max-w-screen-2xl 2xl:max-w-[1600px] px-2 sm:px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 xl:gap-6">
          {/* LEFT: Setup Panel + Policy Validation */}
          <div className="lg:col-span-5 space-y-4 lg:space-y-5">
            {/* Setup Panel */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 lg:p-5 shadow-sm">
              <h2 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-700 mb-2 lg:mb-3">
                Setup Panel
              </h2>

              {/* Delegated Access User */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm lg:text-base font-medium">
                  Delegated Access User
                </h3>
                <div className="flex flex-col gap-2 max-w-xl">
                  <label className="text-xs sm:text-sm font-medium">
                    Add the Delegated Access P256 public key
                  </label>
                  <input
                    type="text"
                    value={daPublicKey}
                    onChange={(e) => setDaPublicKey(e.target.value)}
                    placeholder="Compressed P-256 public key (no 0x), 66 hex chars"
                    className="w-full p-2 lg:p-2.5 border rounded font-mono text-[11px] lg:text-xs"
                    spellCheck={false}
                  />
                  {publicKeyErr && (
                    <div className="text-xs text-red-600">{publicKeyErr}</div>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleDaSetup}
                    className="rounded bg-blue-600 px-3 py-1.5 lg:px-4 lg:py-2 text-white text-xs lg:text-sm hover:bg-blue-700"
                  >
                    Setup User
                  </button>
                </div>

                {daUser && (
                  <div className="p-3 border rounded bg-gray-50 text-left overflow-x-auto">
                    <h4 className="font-semibold mb-2 text-xs lg:text-sm">
                      User Response:
                    </h4>
                    <pre
                      className="font-mono"
                      style={{ fontSize: "var(--mono-size)", lineHeight: 1.35 }}
                    >
                      {JSON.stringify(daUser, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Policy: recipient input -> build template -> submit */}
              <div className="flex flex-col gap-3 mt-5">
                <h3 className="text-sm lg:text-base font-medium">
                  Delegated Access User Policy
                </h3>

                <div className="flex flex-col gap-2 max-w-xl">
                  <label className="text-xs sm:text-sm font-medium">
                    Add the Ethereum recipient address
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="0xabc123…"
                    className="w-full p-2 lg:p-2.5 border rounded font-mono text-[11px] lg:text-xs"
                    spellCheck={false}
                  />
                  {recipientErr && (
                    <div className="text-xs text-red-600">{recipientErr}</div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleBuildPolicyTemplate}
                    className="rounded bg-slate-600 px-3 py-1.5 lg:px-4 lg:py-2 text-white text-xs lg:text-sm hover:bg-slate-700"
                  >
                    Build Policy Template
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitPolicies}
                    disabled={submittingPolicy}
                    className="rounded bg-indigo-600 px-3 py-1.5 lg:px-4 lg:py-2 text-white text-xs lg:text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submittingPolicy ? "Submitting…" : "Submit Policy"}
                  </button>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-2">
                    Policies JSON
                  </label>
                  <div className="p-0.5 border rounded">
                    <textarea
                      value={policyJson}
                      onChange={(e) => setPolicyJson(e.target.value)}
                      spellCheck={false}
                      className="w-full min-h-[220px] max-h-[60vh] p-3 rounded font-mono text-[11px] lg:text-xs"
                    />
                  </div>
                </div>

                {policyError && (
                  <div className="p-3 border border-red-300 bg-red-50 rounded text-red-700 text-xs">
                    {policyError}
                  </div>
                )}
                {policyResult && (
                  <div className="p-3 border rounded bg-gray-50 text-left overflow-x-auto">
                    <h4 className="font-semibold mb-2 text-xs lg:text-sm">
                      Policy Result:
                    </h4>
                    <pre
                      className="font-mono"
                      style={{ fontSize: "var(--mono-size)", lineHeight: 1.35 }}
                    >
                      {JSON.stringify(policyResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </section>

            {/* Policy Validation (Demo) */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 lg:p-5 shadow-sm">
              <h2 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-700 mb-1">
                Policy Validation (Demo)
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-600 mb-4">
                Builds two raw unsigned legacy transactions (one to an allowed
                recipient, one to a denied recipient) and asks Turnkey to sign
                them with the Delegated Access user—so you can verify your
                policy logic quickly.
              </p>

              {/* signWith address */}
              <div className="flex flex-col gap-2 max-w-xl">
                <label className="text-xs sm:text-sm font-medium">
                  Sign With (EVM address)
                </label>
                <input
                  type="text"
                  value={signWithAddress}
                  onChange={(e) => setSignWithAddress(e.target.value)}
                  placeholder="0x… (first embedded account auto-selected)"
                  className="w-full p-2 lg:p-2.5 border rounded font-mono text-[11px] lg:text-xs"
                  spellCheck={false}
                />
                {!/^0x[a-fA-F0-9]{40}$/.test(signWithAddress.trim()) &&
                  !!signWithAddress && (
                    <div className="text-xs text-red-600">
                      Enter a valid 0x-prefixed, 40-hex Ethereum address.
                    </div>
                  )}
              </div>

              {/* Tx-To fields */}
              <div className="flex flex-col gap-2 max-w-2xl mt-4">
                <label className="text-xs sm:text-sm font-medium">
                  Tx To (Allowed)
                </label>
                <input
                  type="text"
                  value={toAllowed}
                  onChange={(e) => setToAllowed(e.target.value)}
                  placeholder="0x recipient to ALLOW"
                  className="w-full p-2 lg:p-2.5 border rounded font-mono text-[11px] lg:text-xs"
                  spellCheck={false}
                />
                {!/^0x[a-fA-F0-9]{40}$/.test(toAllowed.trim()) &&
                  !!toAllowed && (
                    <div className="text-xs text-red-600">
                      Enter a valid 0x-prefixed, 40-hex Ethereum address.
                    </div>
                  )}

                <label className="text-xs sm:text-sm font-medium mt-4">
                  Tx To (Denied) - fill in other Ethereum address
                </label>
                <input
                  type="text"
                  value={toDenied}
                  onChange={(e) => setToDenied(e.target.value)}
                  placeholder="0x recipient to DENY"
                  className="w-full p-2 lg:p-2.5 border rounded font-mono text-[11px] lg:text-xs"
                  spellCheck={false}
                />
                {!/^0x[a-fA-F0-9]{40}$/.test(toDenied.trim()) && !!toDenied && (
                  <div className="text-xs text-red-600">
                    Enter a valid 0x-prefixed, 40-hex Ethereum address.
                  </div>
                )}

                {unsignedAllowHex && (
                  <div className="p-3 border rounded bg-gray-50 overflow-x-auto">
                    <div className="text-[11px] font-medium mb-1">
                      Generated Unsigned (Allow — raw RLP)
                    </div>
                    <pre
                      className="font-mono"
                      style={{ fontSize: "var(--mono-size)", lineHeight: 1.35 }}
                    >
                      {unsignedAllowHex}
                    </pre>
                  </div>
                )}

                {unsignedDenyHex && (
                  <div className="p-3 border rounded bg-gray-50 overflow-x-auto">
                    <div className="text-[11px] font-medium mb-1">
                      Generated Unsigned (Deny — raw RLP)
                    </div>
                    <pre
                      className="font-mono"
                      style={{ fontSize: "var(--mono-size)", lineHeight: 1.35 }}
                    >
                      {unsignedDenyHex}
                    </pre>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={runValidationDemo}
                disabled={valLoading}
                className="mt-4 rounded bg-emerald-600 px-3 py-1.5 lg:px-4 lg:py-2 text-white text-xs lg:text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {valLoading ? "Validating..." : "Run Validation"}
              </button>

              {valError && (
                <div className="mt-3 p-3 border border-red-300 bg-red-50 rounded text-red-700 text-xs">
                  {valError}
                </div>
              )}
              {valResult && (
                <div className="mt-3 p-3 border rounded bg-gray-50 text-left overflow-x-auto">
                  <h3 className="font-semibold mb-2 text-xs lg:text-sm">
                    Validation Result:
                  </h3>
                  <pre
                    className="font-mono"
                    style={{ fontSize: "var(--mono-size)", lineHeight: 1.35 }}
                  >
                    {JSON.stringify(valResult, null, 2)}
                  </pre>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT: Live Sub-Org State */}
          <div className="lg:col-span-7 space-y-4 lg:space-y-5">
            <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 lg:p-5 shadow-sm">
              <h2 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-700 mb-3 lg:mb-4">
                Live Sub-Org State
              </h2>

              <div className="mb-3 text-[11px] sm:text-xs text-gray-700">
                <div>
                  <span className="font-medium">Welcome back,</span>{" "}
                  {user?.userName}!
                </div>
                <div>
                  <span className="font-medium">Your sub-organization id:</span>{" "}
                  <span className="font-mono">
                    {session?.organizationId ?? "Not found"}
                  </span>
                </div>
              </div>

              {/* Users */}
              <section className="flex flex-col gap-2 mb-4">
                <h3 className="font-semibold text-gray-900 text-sm lg:text-base">
                  Users
                </h3>
                <div className="p-3 border rounded bg-white border-gray-200 shadow-sm text-left overflow-x-auto">
                  {orgMetaLoading ? (
                    <div className="text-xs text-gray-600">Loading users…</div>
                  ) : orgMetaError ? (
                    <div className="text-xs text-red-600">{orgMetaError}</div>
                  ) : (
                    <pre
                      className="font-mono"
                      style={{
                        fontSize: "var(--mono-size)",
                        lineHeight: 1.35,
                        minWidth: "60ch",
                      }}
                    >
                      {JSON.stringify(orgUsers ?? [], null, 2)}
                    </pre>
                  )}
                </div>
              </section>

              {/* Root Quorum */}
              <section className="flex flex-col gap-2 mb-4">
                <h3 className="font-semibold text-gray-900 text-sm lg:text-base">
                  Root Quorum
                </h3>
                <div className="p-3 border rounded bg-white border-gray-200 shadow-sm text-left overflow-x-auto">
                  {orgMetaLoading ? (
                    <div className="text-xs text-gray-600">Loading quorum…</div>
                  ) : orgMetaError ? (
                    <div className="text-xs text-red-600">{orgMetaError}</div>
                  ) : (
                    <pre
                      className="font-mono"
                      style={{
                        fontSize: "var(--mono-size)",
                        lineHeight: 1.35,
                        minWidth: "60ch",
                      }}
                    >
                      {JSON.stringify(orgRootQuorum ?? {}, null, 2)}
                    </pre>
                  )}
                </div>
              </section>

              {/* Policies */}
              <section className="flex flex-col gap-2 mb-4">
                <h3 className="font-semibold text-gray-900 text-sm lg:text-base">
                  Policies
                </h3>
                <div className="p-3 border rounded bg-white border-gray-200 shadow-sm text-left overflow-x-auto">
                  {orgMetaLoading ? (
                    <div className="text-xs text-gray-600">
                      Loading policies…
                    </div>
                  ) : orgMetaError ? (
                    <div className="text-xs text-red-600">{orgMetaError}</div>
                  ) : (
                    <pre
                      className="font-mono"
                      style={{
                        fontSize: "var(--mono-size)",
                        lineHeight: 1.35,
                        minWidth: "60ch",
                      }}
                    >
                      {JSON.stringify(orgPolicies ?? [], null, 2)}
                    </pre>
                  )}
                </div>
              </section>

              {/* Wallet Accounts */}
              <section className="flex flex-col gap-2">
                <h3 className="font-semibold text-gray-900 text-sm lg:text-base">
                  Wallet Accounts
                </h3>
                <div className="p-3 border rounded bg-white border-gray-200 shadow-sm text-left overflow-x-auto">
                  <pre
                    className="font-mono"
                    style={{
                      fontSize: "var(--mono-size)",
                      lineHeight: 1.35,
                      minWidth: "60ch",
                    }}
                  >
                    {JSON.stringify(accountsData ?? [], null, 2)}
                  </pre>
                </div>
              </section>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
