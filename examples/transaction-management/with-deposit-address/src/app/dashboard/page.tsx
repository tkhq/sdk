"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  useTurnkey,
  AuthState,
  ClientState,
  WalletSource,
} from "@turnkey/react-wallet-kit";

import {
  USDC_ADDRESS,
  USDC_INTERFACE,
  buildSweepPolicies,
  findSweepDestinations,
  parseAddress,
  parseDestination,
} from "@/lib/deposit";
import { SweepHistory } from "./SweepHistory";
import {
  Card,
  CopyButton,
  ErrorNotice,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "./ui";
import { WithdrawPanel } from "./WithdrawPanel";
import {
  registerDepositAddress,
  type RegisterResult,
} from "@/server/actions/registerDepositAddress";

const DA_PUBLIC_KEY = process.env.NEXT_PUBLIC_DA_PUBLIC_KEY?.trim() ?? "";
// Optional. Only pre-fills the destination field, to make testing easier.
const DEFAULT_DESTINATION =
  process.env.NEXT_PUBLIC_DEFAULT_DESTINATION_ADDRESS?.trim() ?? "";

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
  hasUsdcInterface: boolean;
};

function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export default function Dashboard() {
  const {
    authState,
    clientState,
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
  const [destinationInput, setDestinationInput] = useState(DEFAULT_DESTINATION);

  // `authState` reads Unauthenticated until the stored session is restored, so
  // wait for the client. Otherwise every reload lands on the login page.
  useEffect(() => {
    if (
      clientState === ClientState.Ready &&
      authState === AuthState.Unauthenticated
    ) {
      router.replace("/");
    }
  }, [authState, clientState, router]);

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
      const [usersRes, policiesRes, configsRes, interfacesRes] =
        await Promise.all([
          httpClient.getUsers({ organizationId: subOrgId }),
          httpClient.getPolicies({ organizationId: subOrgId }),
          httpClient.getOrganizationConfigs({ organizationId: subOrgId }),
          httpClient.getSmartContractInterfaces({ organizationId: subOrgId }),
        ]);
      setOrg({
        users: usersRes.users,
        rootUserIds: configsRes.configs.quorum?.userIds ?? [],
        policies: policiesRes.policies,
        hasUsdcInterface: interfacesRes.smartContractInterfaces.some(
          (i) => parseAddress(i.smartContractAddress) === USDC_ADDRESS,
        ),
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

  const sweepDestination = useMemo(() => {
    if (!delegatedUser || !org) return null;
    return findSweepDestinations(org.policies, delegatedUser.userId)[0] ?? null;
  }, [delegatedUser, org]);

  const enabled = Boolean(
    delegatedUser && sweepDestination && org?.hasUsdcInterface,
  );

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
      if (!depositAddress || !subOrgId) {
        throw new Error("No embedded Ethereum account found for this user.");
      }
      if (!httpClient || !org) {
        throw new Error("The sub-organization has not loaded yet.");
      }
      // Policies from an interrupted attempt keep their destination. Taking a
      // new one here would leave extra policies in the sub-org.
      const destination = parseDestination(
        sweepDestination ?? destinationInput,
        depositAddress,
      );
      if (!destination.ok) throw new Error(destination.error);

      // Every call is stamped by the user's session, and each is idempotent.
      // The ABI goes first, so the USDC policy works as soon as it exists.
      if (!org.hasUsdcInterface) {
        await httpClient.createSmartContractInterface({
          organizationId: subOrgId,
          ...USDC_INTERFACE,
        });
      }

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
        policies: buildSweepPolicies(daUser.userId, destination.address),
      });

      await loadOrg();
    } catch (e) {
      setEnableError(errorMessage(e, "Failed to enable the deposit address."));
    } finally {
      setEnabling(false);
    }
  };

  if (authState !== AuthState.Authenticated) {
    return <p className="p-6 text-center text-sm text-slate-500">Loading…</p>;
  }

  const rootIsUserOnly =
    !!org &&
    !!user &&
    org.rootUserIds.length === 1 &&
    org.rootUserIds[0] === user.userId;
  const delegatedIsNonRoot =
    !!delegatedUser && !org?.rootUserIds.includes(delegatedUser.userId);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Deposit address</h1>
          <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs text-slate-600">
            Base Sepolia testnet
          </span>
        </div>
        <button
          type="button"
          onClick={async () => {
            await logout();
            router.push("/");
          }}
          className={TEXT_BUTTON_CLASS}
        >
          Log out
        </button>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Card
            title={
              enabled ? "Your deposit address" : "Enable a deposit address"
            }
            action={
              enabled && depositAddress ? (
                <CopyButton value={depositAddress} />
              ) : undefined
            }
          >
            {!enabled && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-600">
                  This adds a non-root API key user to your sub-organization and
                  two policies that let it send ETH and USDC only to the
                  destination below. You approve it from your own session and
                  stay the only root user.
                </p>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-700">
                  Destination for your deposits
                  <input
                    type="text"
                    value={sweepDestination ?? destinationInput}
                    onChange={(e) => setDestinationInput(e.target.value)}
                    disabled={!!sweepDestination}
                    placeholder="0x…"
                    spellCheck={false}
                    className={`${INPUT_CLASS} font-normal`}
                  />
                </label>
                <div>
                  <button
                    type="button"
                    onClick={handleEnable}
                    disabled={enabling}
                    className={PRIMARY_BUTTON_CLASS}
                  >
                    {enabling ? "Enabling…" : "Enable deposit address"}
                  </button>
                </div>
              </div>
            )}

            {enabled && depositAddress && (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="self-start rounded-lg border border-slate-200 bg-white p-2.5">
                  <QRCodeSVG value={depositAddress} size={132} />
                </div>
                <div className="min-w-0 space-y-3">
                  <code className="block font-mono text-sm break-all">
                    {depositAddress}
                  </code>
                  <div className="text-sm text-slate-600">
                    Send ETH or USDC on Base Sepolia. Each deposit is swept to:
                    <code className="mt-1 block font-mono text-xs break-all text-slate-900">
                      {sweepDestination}
                    </code>
                  </div>
                  {registration?.ok && (
                    <p className="flex items-center gap-1.5 text-xs text-emerald-700">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Watching for deposits
                    </p>
                  )}
                  {registration === null && (
                    <p className="text-xs text-slate-500">
                      Registering with the server…
                    </p>
                  )}
                </div>
              </div>
            )}

            {registration && !registration.ok && (
              <ErrorNotice>
                Not watching this address: {registration.error}
              </ErrorNotice>
            )}
            {enableError && <ErrorNotice>{enableError}</ErrorNotice>}
          </Card>

          {enabled && depositAddress && (
            <Card title="Sweeps to your destination">
              <SweepHistory address={depositAddress} />
            </Card>
          )}
        </div>

        <div className="space-y-5 lg:col-span-2">
          <Card
            title="Who controls this wallet"
            action={
              <button
                type="button"
                onClick={() => void loadOrg()}
                className={TEXT_BUTTON_CLASS}
              >
                Refresh
              </button>
            }
          >
            {orgError && <ErrorNotice>{orgError}</ErrorNotice>}

            {org && (
              <>
                <ul className="space-y-2 text-xs">
                  <Check ok={rootIsUserOnly}>You are the only root user</Check>
                  <Check ok={delegatedIsNonRoot}>
                    The platform&apos;s delegated user is not root
                  </Check>
                  <Check ok={org.policies.length === 2 && !!sweepDestination}>
                    Exactly two policies, ETH and USDC, limit it to your
                    destination
                  </Check>
                  <Check ok={org.hasUsdcInterface}>
                    USDC ABI uploaded, so the USDC policy can read the recipient
                  </Check>
                </ul>

                <details className="mt-4 border-t border-slate-100 pt-3 text-xs">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-900">
                    Details
                  </summary>
                  <dl className="mt-3 space-y-1 text-slate-600">
                    <div>
                      <dt className="inline font-medium">Signed in as </dt>
                      <dd className="inline">{user?.userName}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Sub-organization </dt>
                      <dd className="inline font-mono break-all">{subOrgId}</dd>
                    </div>
                  </dl>
                  <RawJson title="Users" value={org.users} />
                  <RawJson
                    title="Root quorum user IDs"
                    value={org.rootUserIds}
                  />
                  <RawJson title="Policies" value={org.policies} />
                </details>
              </>
            )}
          </Card>

          {depositAddress && subOrgId && (
            <Card title="Withdraw">
              <p className="mb-3 text-xs text-slate-600">
                Signed with your own login. The platform&apos;s key is not
                involved and cannot stop it.
              </p>
              <WithdrawPanel subOrgId={subOrgId} address={depositAddress} />
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex gap-2 ${ok ? "text-slate-800" : "text-slate-400"}`}>
      <span className={ok ? "text-emerald-600" : "text-slate-300"}>
        {ok ? "✓" : "○"}
      </span>
      <span>{children}</span>
    </li>
  );
}

function RawJson({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="mt-3">
      <p className="mb-1 font-medium text-slate-600">{title}</p>
      <pre className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] leading-snug">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
