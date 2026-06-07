import "server-only";
import { generateP256KeyPair } from "@turnkey/crypto";
import { DEFAULT_ETHEREUM_ACCOUNTS } from "@turnkey/sdk-server";
import { getParentClient, getSubOrgClient } from "./clients";
import { encryptAtRest } from "@/server/crypto";

function makeP256ApiKey() {
  const kp = generateP256KeyPair();
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

function buildReclaimPolicy(sweepUserId: string, reclaimAddress: string) {
  const addr = reclaimAddress.toLowerCase().replace(/^0x/, "");
  const condition = [
    `(eth.tx.to == '0x${addr}' && eth.tx.data == '0x')`,
    `(eth.tx.function_signature == '0xa9059cbb' && eth.tx.data[34..74] == '${addr}')`,
  ].join(" || ");
  return {
    policyName: "Sweep key: transfer-back-to-sender only",
    effect: "EFFECT_ALLOW" as const,
    consensus: `approvers.any(user, user.id == '${sweepUserId}')`,
    condition,
    notes: "Auto-generated for EVM sub-org claim link.",
  };
}

export interface BootstrapInput {
  senderReclaimAddress: string;
  claimKeyPublicKey: string;
  expirationSeconds: number;
}

export interface BootstrapResult {
  subOrgId: string;
  escrowAddress: string;
  walletId: string;
  sweepKey: { publicKey: string; privateKeyEnc: string; policyId: string };
}

/**
 * Bootstrap a sub-org for one claim link — three steps, order matters:
 *   1. Create sub-org with claim key + sweep key both as root users.
 *   2. Sweep key (still root) installs a policy locking it to sender-only transfers.
 *   3. Sweep key demotes itself — after this it can only act via the policy.
 */
export async function bootstrapClaimSubOrg(
  input: BootstrapInput,
): Promise<BootstrapResult> {
  const parent = getParentClient().apiClient();

  type RootUser = {
    userName: string;
    apiKeys: Array<{
      apiKeyName: string;
      publicKey: string;
      curveType: "API_KEY_CURVE_P256";
      expirationSeconds?: string;
    }>;
    authenticators: Array<never>;
    oauthProviders: Array<never>;
  };

  // Turnkey requires at least one non-expiring credential per root user.
  // The claim key has a TTL so we add a throwaway anchor (private key discarded).
  const claimAnchor = makeP256ApiKey();
  const claimUser: RootUser = {
    userName: "Claim Recipient",
    apiKeys: [
      {
        apiKeyName: "Claim API Key",
        publicKey: input.claimKeyPublicKey,
        curveType: "API_KEY_CURVE_P256",
        expirationSeconds: String(input.expirationSeconds),
      },
      {
        apiKeyName: "Claim Anchor",
        publicKey: claimAnchor.publicKey,
        curveType: "API_KEY_CURVE_P256",
      },
    ],
    authenticators: [],
    oauthProviders: [],
  };

  const sweep = makeP256ApiKey();
  const sweepUser: RootUser = {
    userName: "Sweep",
    apiKeys: [
      {
        apiKeyName: "Sweep API Key",
        publicKey: sweep.publicKey,
        curveType: "API_KEY_CURVE_P256",
      },
    ],
    authenticators: [],
    oauthProviders: [],
  };

  // Step 1
  const created = await parent.createSubOrganization({
    subOrganizationName: `claim-${Date.now()}`,
    rootUsers: [claimUser, sweepUser] as unknown as Parameters<
      typeof parent.createSubOrganization
    >[0]["rootUsers"],
    rootQuorumThreshold: 1,
    wallet: {
      walletName: "Escrow Wallet",
      accounts: DEFAULT_ETHEREUM_ACCOUNTS,
    },
  });

  const { subOrganizationId: subOrgId, wallet, rootUserIds = [] } = created;
  const escrowAddress = wallet?.addresses?.[0];
  const walletId = wallet?.walletId;

  if (!subOrgId || !escrowAddress || !walletId)
    throw new Error(`createSubOrganization incomplete`);
  if (rootUserIds.length !== 2)
    throw new Error(
      `Expected 2 root user ids, got: ${JSON.stringify(rootUserIds)}`,
    );

  const [claimUserId, sweepUserId] = rootUserIds as [string, string];
  const sweepClient = getSubOrgClient({
    subOrgId,
    apiPublicKey: sweep.publicKey,
    apiPrivateKey: sweep.privateKey,
  }).apiClient();

  // Step 2
  const { policyId } = await sweepClient.createPolicy(
    buildReclaimPolicy(sweepUserId, input.senderReclaimAddress),
  );
  if (!policyId) throw new Error("createPolicy did not return a policyId");

  // Step 3
  await sweepClient.updateRootQuorum({ threshold: 1, userIds: [claimUserId] });

  return {
    subOrgId,
    escrowAddress,
    walletId,
    sweepKey: {
      publicKey: sweep.publicKey,
      privateKeyEnc: encryptAtRest(sweep.privateKey),
      policyId,
    },
  };
}
