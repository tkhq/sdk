"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useTurnkey,
  AuthState,
  WalletSource,
  type Wallet,
} from "@turnkey/react-wallet-kit";

interface PolicyDetail {
  policyId: string;
  policyName: string;
  effect: string;
  condition?: string;
  consensus?: string;
  notes?: string;
}

interface AgentSetup {
  agentUserId: string;
  policies: PolicyDetail[];
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xs font-mono break-all text-gray-700">{value}</div>
    </div>
  );
}

const POLICY_NAMES = [
  "agent-allow-free",
  "agent-allow-with-approval",
  "agent-self-delete",
];

export default function SetupPage() {
  const router = useRouter();
  const {
    authState,
    logout,
    session,
    wallets,
    httpClient,
    fetchOrCreateP256ApiKeyUser,
    fetchOrCreatePolicies,
  } = useTurnkey();

  useEffect(() => {
    if (authState === AuthState.Unauthenticated) router.replace("/");
  }, [authState, router]);

  const walletAddress = useMemo(() => {
    return (
      (wallets ?? [])
        .filter((w: Wallet) => w.source === WalletSource.Embedded)
        .flatMap((w) => w.accounts ?? [])
        .find((a) => a.addressFormat?.includes("ETHEREUM"))?.address ?? null
    );
  }, [wallets]);

  const [setup, setSetup] = useState<AgentSetup | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [setting, setSetting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load existing agent state whenever the session is ready
  useEffect(() => {
    if (authState !== AuthState.Authenticated) return;
    if (!httpClient || !session?.organizationId) return;

    const orgId = session.organizationId;
    const agentPublicKey = process.env.NEXT_PUBLIC_AGENT_API_PUBLIC_KEY;
    if (!agentPublicKey) return;

    setLoadingSetup(true);
    void (async () => {
      try {
        const [usersRes, policiesRes] = await Promise.all([
          httpClient.getUsers({ organizationId: orgId }),
          httpClient.getPolicies({ organizationId: orgId }),
        ]);

        const agentUser = (usersRes as any).users?.find((u: any) =>
          u.apiKeys?.some(
            (k: any) => k.credential?.publicKey === agentPublicKey,
          ),
        );
        if (!agentUser) return;

        const allPolicies: any[] = (policiesRes as any).policies ?? [];
        const agentPolicies = POLICY_NAMES.map((name) =>
          allPolicies.find((p: any) => p.policyName === name),
        ).filter(Boolean);
        if (agentPolicies.length === 0) return;

        setSetup({
          agentUserId: agentUser.userId,
          policies: agentPolicies.map((p: any) => ({
            policyId: p.policyId,
            policyName: p.policyName,
            effect: p.effect,
            condition: p.condition,
            consensus: p.consensus,
            notes: p.notes,
          })),
        });
      } catch {
        // not configured yet
      } finally {
        setLoadingSetup(false);
      }
    })();
  }, [authState, httpClient, session?.organizationId]);

  const handleSetup = async () => {
    if (!session?.organizationId) return;
    setSetting(true);
    setErr(null);
    try {
      const agentPublicKey = process.env.NEXT_PUBLIC_AGENT_API_PUBLIC_KEY!;
      const allowedRecipient = process.env.NEXT_PUBLIC_ALLOWED_RECIPIENT!;
      const approvalRecipient = process.env.NEXT_PUBLIC_APPROVAL_RECIPIENT!;

      // Resolve the human user's ID so we can pin it in the approval policy consensus
      const whoami = await httpClient!.getWhoami({
        organizationId: session.organizationId,
      });
      const humanUserId = (whoami as any).userId as string;

      // Create or find the agent non-root user (stamped with the user's session key)
      const agentUser = await fetchOrCreateP256ApiKeyUser({
        publicKey: agentPublicKey,
        createParams: {
          userName: "agent",
          apiKeyName: "agent-key",
        },
      });
      const agentUserId = (agentUser as any).userId as string;

      // Create or find the three signing policies
      const policiesRes = await fetchOrCreatePolicies({
        policies: [
          {
            policyName: "agent-allow-free",
            effect: "EFFECT_ALLOW",
            condition: `eth.tx.to == '${allowedRecipient.toLowerCase()}'`,
            consensus: `approvers.any(user, user.id == '${agentUserId}')`,
            notes:
              "Agent may freely sign transactions to the allowed recipient.",
          },
          {
            policyName: "agent-allow-with-approval",
            effect: "EFFECT_ALLOW",
            condition: `eth.tx.to == '${approvalRecipient.toLowerCase()}'`,
            consensus: `approvers.any(user, user.id == '${agentUserId}') && approvers.any(user, user.id == '${humanUserId}')`,
            notes:
              "Agent may sign to the approval recipient only after the human user approves (agent + human, both required).",
          },
          {
            policyName: "agent-self-delete",
            effect: "EFFECT_ALLOW",
            condition: `activity.type == 'ACTIVITY_TYPE_DELETE_USERS' && activity.params.user_ids.count() == 1 && '${agentUserId}' in activity.params.user_ids`,
            consensus: `approvers.any(user, user.id == '${agentUserId}')`,
            notes: "Agent may delete itself to self-remediate if compromised.",
          },
        ],
      });

      setSetup({
        agentUserId,
        policies: policiesRes.map((p) => ({
          policyId: p.policyId,
          policyName: (p as any).policyName ?? "",
          effect: (p as any).effect ?? "",
          condition: (p as any).condition,
          consensus: (p as any).consensus,
          notes: (p as any).notes,
        })),
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Setup failed.");
    } finally {
      setSetting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.replace("/");
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  if (authState !== AuthState.Authenticated) {
    return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  }

  const orgId = session?.organizationId ?? "—";

  return (
    <main className="p-6">
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
      >
        Logout
      </button>

      <div className="mx-auto max-w-2xl space-y-6 pt-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Agent Setup</h1>
          <p className="mt-1 text-sm text-gray-500">
            Creates a non-root agent user and three signing policies in your
            sub-org using your session key. Safe to run multiple times —
            already-created resources are reused.
          </p>
        </div>

        {/* Sub-org info */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Sub-org</h2>
          <InfoRow label="Organization ID" value={orgId} />
          <InfoRow
            label="Wallet address"
            value={walletAddress ?? "(loading…)"}
          />
          <InfoRow
            label="Agent public key"
            value={
              process.env.NEXT_PUBLIC_AGENT_API_PUBLIC_KEY ?? "(not configured)"
            }
          />
          <InfoRow
            label="Allowed recipient"
            value={
              process.env.NEXT_PUBLIC_ALLOWED_RECIPIENT ?? "(not configured)"
            }
          />
          <InfoRow
            label="Approval recipient"
            value={
              process.env.NEXT_PUBLIC_APPROVAL_RECIPIENT ?? "(not configured)"
            }
          />
        </section>

        {/* Setup button */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              Configure policies
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Your session key creates the agent user and policies directly in
              your sub-org — no admin key involved.
            </p>
          </div>

          <button
            onClick={() => void handleSetup()}
            disabled={setting || loadingSetup}
            className="rounded bg-slate-700 px-5 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {setting
              ? "Setting up…"
              : loadingSetup
                ? "Loading…"
                : setup
                  ? "Re-run setup"
                  : "Setup agent"}
          </button>

          {err && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-700">
              {err}
            </div>
          )}

          {setup && (
            <div className="rounded border border-green-200 bg-green-50 p-4 space-y-4">
              <div className="text-xs font-semibold text-green-800">
                Agent configured
              </div>
              <InfoRow label="Agent user ID" value={setup.agentUserId} />
              {setup.policies.map((p) => (
                <div key={p.policyId} className="space-y-1">
                  <div className="text-xs text-gray-400">{p.policyName}</div>
                  <div className="text-xs font-mono text-gray-600 break-all">
                    {p.policyId}
                  </div>
                  <pre className="rounded border border-gray-100 bg-white p-2 text-[10px] font-mono text-gray-700 whitespace-pre-wrap break-all">
                    {JSON.stringify(
                      {
                        effect: p.effect,
                        condition: p.condition,
                        consensus: p.consensus,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </section>

        {setup && (
          <button
            onClick={() => router.push("/dashboard/test")}
            className="w-full rounded bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Test setup →
          </button>
        )}
      </div>
    </main>
  );
}
