"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useTurnkey, AuthState, WalletSource } from "@turnkey/react-wallet-kit";

import { buildSweepPolicy, parseAddress } from "@/lib/deposit";
import { SweepHistory } from "./SweepHistory";
import { WithdrawPanel } from "./WithdrawPanel";
import {
  registerDepositAddress,
  type RegisterResult,
} from "@/server/actions/registerDepositAddress";

const DA_PUBLIC_KEY = process.env.NEXT_PUBLIC_DA_PUBLIC_KEY?.trim() ?? "";
const TREASURY = parseAddress(process.env.NEXT_PUBLIC_TREASURY_ADDRESS);

// The fields of the sub-organization this page reads.
type OrgUser = {
  userId: string;
  userName: string;
  apiKeys: { credential: { publicKey: string } }[];
};
type OrgPolicy = {
  policyId: string;
  policyName: string;
  effect: string;
  consensus: string;
  condition: string;
};
type OrgState = {
  users: OrgUser[];
  rootUserIds: string[];
  policies: OrgPolicy[];
};

function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export default function Dashboard() {
  const {
    authState,
    user,
    session,
    logout,
    wallets,
    httpClient,
    fetchOrCreateP256ApiKeyUser,
    fetchOrCreatePolicies,
  } = useTurnkey();
  const router = useRouter();

  const [org, setOrg] = useState<OrgState | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);

  useEffect(() => {
    if (authState === AuthState.Unauthenticated) {
      router.replace("/");
    }
  }, [authState, router]);

  // The deposit address is the first Ethereum account of the embedded wallet
  // created at sign-up.
  const depositAddress = useMemo(() => {
    for (const wallet of wallets ?? []) {
      if (wallet.source !== WalletSource.Embedded) continue;
      const account = wallet.accounts.find(
        (a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM",
      );
      const address = parseAddress(account?.address);
      if (address) return address;
    }
    return null;
  }, [wallets]);

  const subOrgId = session?.organizationId;

  const loadOrg = useCallback(async () => {
    if (!httpClient || !subOrgId) return;
    try {
      setOrgError(null);
      const [usersRes, policiesRes, configsRes] = await Promise.all([
        httpClient.getUsers({ organizationId: subOrgId }),
        httpClient.getPolicies({ organizationId: subOrgId }),
        httpClient.getOrganizationConfigs({ organizationId: subOrgId }),
      ]);
      setOrg({
        users: usersRes.users,
        rootUserIds: configsRes.configs.quorum?.userIds ?? [],
        policies: policiesRes.policies,
      });
    } catch (e) {
      setOrgError(errorMessage(e, "Failed to load sub-organization."));
    }
  }, [httpClient, subOrgId]);

  useEffect(() => {
    if (authState === AuthState.Authenticated) void loadOrg();
  }, [authState, loadOrg]);

  // Derive "enabled" from the sub-org itself, so a page reload or a second
  // device shows the same state without any app-side storage.
  const delegatedUser = useMemo(
    () =>
      org?.users.find((u) =>
        u.apiKeys.some((k) => k.credential.publicKey === DA_PUBLIC_KEY),
      ) ?? null,
    [org],
  );

  const sweepPolicy = useMemo(() => {
    if (!delegatedUser || !TREASURY || !org) return null;
    const expected = buildSweepPolicy(delegatedUser.userId, TREASURY);
    return (
      org.policies.find(
        (p) =>
          p.condition === expected.condition &&
          p.consensus === expected.consensus,
      ) ?? null
    );
  }, [delegatedUser, org]);

  const enabled = Boolean(delegatedUser && sweepPolicy);

  // Tell the server which sub-org owns the address so the webhook can route
  // deposits. Runs whenever the sub-org shows the address as enabled, which
  // also repairs the mapping after a server restart or a wiped registry.
  const [registration, setRegistration] = useState<RegisterResult | null>(null);
  useEffect(() => {
    if (!enabled || !depositAddress || !subOrgId) return;
    let cancelled = false;
    registerDepositAddress(subOrgId, depositAddress).then((res) => {
      if (!cancelled) setRegistration(res);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, depositAddress, subOrgId]);

  const handleEnable = async () => {
    setEnableError(null);
    setEnabling(true);
    try {
      if (!DA_PUBLIC_KEY) {
        throw new Error("NEXT_PUBLIC_DA_PUBLIC_KEY is not set.");
      }
      if (!TREASURY) {
        throw new Error("NEXT_PUBLIC_TREASURY_ADDRESS is missing or invalid.");
      }
      if (!depositAddress) {
        throw new Error("No embedded Ethereum account found for this user.");
      }

      // Both calls are stamped by the user's session, and both are idempotent.
      // `createUsers` never adds a user to the root quorum, so the delegated
      // user is non-root from the moment it exists.
      const daUser = await fetchOrCreateP256ApiKeyUser({
        publicKey: DA_PUBLIC_KEY,
        createParams: {
          userName: "Deposit sweeper",
          apiKeyName: "Deposit sweeper key",
        },
      });
      await fetchOrCreatePolicies({
        policies: [buildSweepPolicy(daUser.userId, TREASURY)],
      });

      await loadOrg();
    } catch (e) {
      setEnableError(errorMessage(e, "Failed to enable the deposit address."));
    } finally {
      setEnabling(false);
    }
  };

  if (authState !== AuthState.Authenticated) {
    return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  }

  const rootIsUserOnly =
    !!org &&
    !!user &&
    org.rootUserIds.length === 1 &&
    org.rootUserIds[0] === user.userId;
  const delegatedIsNonRoot =
    !!delegatedUser && !org?.rootUserIds.includes(delegatedUser.userId);

  return (
    <main className="relative min-h-screen p-4 sm:p-6">
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

      <div className="mt-12 mx-auto max-w-screen-xl px-2 sm:px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          {/* LEFT: deposit address */}
          <div className="lg:col-span-5 space-y-4 lg:space-y-5">
            <section className="rounded-xl border border-gray-200 bg-white p-4 lg:p-5 shadow-sm">
              <h2 className="text-sm lg:text-base font-semibold text-gray-700 mb-3">
                Deposit address
              </h2>

              {!enabled && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs sm:text-sm text-gray-600">
                    Enabling adds a non-root API key user to your
                    sub-organization and one policy that lets it send ETH and
                    USDC only to the treasury{" "}
                    <span className="font-mono break-all">{TREASURY}</span>. You
                    stay the only root user.
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={handleEnable}
                      disabled={enabling}
                      className="rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {enabling ? "Enabling…" : "Enable deposit address"}
                    </button>
                  </div>
                </div>
              )}

              {enabled && depositAddress && (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-xs sm:text-sm text-gray-600">
                    Send ETH or USDC on <strong>Base Sepolia</strong> to this
                    address. Deposits are swept to the treasury automatically.
                  </p>
                  <div className="rounded border border-gray-200 bg-white p-3">
                    <QRCodeSVG value={depositAddress} size={168} />
                  </div>
                  <code className="font-mono text-xs break-all">
                    {depositAddress}
                  </code>
                  <p className="text-xs text-gray-500">
                    {registration === null
                      ? "Registering with the server…"
                      : registration.ok
                        ? "Watching for deposits."
                        : ""}
                  </p>
                </div>
              )}

              {registration && !registration.ok && (
                <div className="mt-3 p-3 border border-red-300 bg-red-50 rounded text-red-700 text-xs">
                  Not watching this address: {registration.error}
                </div>
              )}

              {enableError && (
                <div className="mt-3 p-3 border border-red-300 bg-red-50 rounded text-red-700 text-xs">
                  {enableError}
                </div>
              )}
            </section>

            {enabled && depositAddress && (
              <section className="rounded-xl border border-gray-200 bg-white p-4 lg:p-5 shadow-sm">
                <h2 className="text-sm lg:text-base font-semibold text-gray-700 mb-3">
                  Sweeps to treasury
                </h2>
                <SweepHistory address={depositAddress} />
              </section>
            )}

            {depositAddress && subOrgId && (
              <section className="rounded-xl border border-gray-200 bg-white p-4 lg:p-5 shadow-sm">
                <h2 className="text-sm lg:text-base font-semibold text-gray-700 mb-1">
                  Withdraw
                </h2>
                <p className="text-xs text-gray-600 mb-3">
                  Signed with your own login. The platform&apos;s key is not
                  involved and cannot stop it.
                </p>
                <WithdrawPanel subOrgId={subOrgId} address={depositAddress} />
              </section>
            )}
          </div>

          {/* RIGHT: live sub-org state */}
          <div className="lg:col-span-7 space-y-4 lg:space-y-5">
            <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 lg:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm lg:text-base font-semibold text-gray-700">
                  Live sub-org state
                </h2>
                <button
                  type="button"
                  onClick={() => void loadOrg()}
                  className="text-xs text-blue-700 hover:underline"
                >
                  Refresh
                </button>
              </div>

              <div className="mb-3 text-xs text-gray-700 space-y-0.5">
                <div>
                  <span className="font-medium">Signed in as:</span>{" "}
                  {user?.userName}
                </div>
                <div>
                  <span className="font-medium">Sub-organization:</span>{" "}
                  <span className="font-mono">{subOrgId ?? "Not found"}</span>
                </div>
              </div>

              {orgError && (
                <div className="mb-3 text-xs text-red-600">{orgError}</div>
              )}

              {org && (
                <>
                  <ul className="mb-4 text-xs space-y-1">
                    <Check ok={rootIsUserOnly}>Root quorum is you alone</Check>
                    <Check ok={delegatedIsNonRoot}>
                      Delegated user exists and is not root
                    </Check>
                    <Check ok={org.policies.length === 1 && !!sweepPolicy}>
                      Exactly one policy, scoped to the treasury
                    </Check>
                  </ul>

                  <RawJson title="Users" value={org.users} />
                  <RawJson
                    title="Root quorum user IDs"
                    value={org.rootUserIds}
                  />
                  <RawJson title="Policies" value={org.policies} />
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={ok ? "text-emerald-700" : "text-gray-500"}>
      {ok ? "✓" : "○"} {children}
    </li>
  );
}

function RawJson({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="mb-2">
      <summary className="cursor-pointer text-sm font-semibold text-gray-900">
        {title}
      </summary>
      <pre className="mt-2 p-3 border rounded bg-white border-gray-200 overflow-x-auto font-mono text-[11px] leading-snug">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
