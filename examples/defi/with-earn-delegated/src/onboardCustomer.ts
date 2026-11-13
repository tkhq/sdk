import {
  C,
  chainName,
  header,
  newClient,
  PARENT_TAG,
  requireEnv,
  USER_TAG,
} from "./common";
import {
  buildPolicies,
  DEPOSIT_WALLET,
  EARN_WALLET,
  findCustomerOrgId,
  loadCustomer,
  printAssetLists,
  SUB_ORG_NAME,
  supportedAssets,
  WALLET_ACCOUNTS,
} from "./delegated";

// Step 1: onboard the customer. Safe to re-run: each step checks before it
// creates, and re-running after enabling a vault updates the policies.
//
// The parent org only creates the sub-org. Everything inside it is done by the
// customer's own root key: the Earn wallet, the platform's non-root delegated
// user, and the policies that are that user's only rights.
async function main() {
  const delegatedPublicKey = requireEnv("DELEGATED_API_PUBLIC_KEY");

  // ── Parent: find or create the customer's sub-org ────────────────────────
  header("Find or create the customer sub-org", PARENT_TAG);
  const { client: parent, organizationId: parentOrgId } = newClient("PARENT");

  let subOrgId = await findCustomerOrgId(parent, parentOrgId);
  if (subOrgId) {
    console.log(`${C.green}✓${C.reset} existing sub-org ${subOrgId}`);
  } else {
    // Never retried: if this call times out but succeeded, the next run's
    // lookup finds the sub-org instead of creating a second one.
    await parent.createSubOrganization({
      organizationId: parentOrgId,
      subOrganizationName: SUB_ORG_NAME,
      rootUsers: [
        {
          userName: "Customer",
          apiKeys: [
            {
              apiKeyName: "customer-root-key",
              publicKey: requireEnv("CUSTOMER_API_PUBLIC_KEY"),
              curveType: "API_KEY_CURVE_P256",
            },
          ],
          authenticators: [],
          oauthProviders: [],
        },
      ],
      rootQuorumThreshold: 1,
      wallet: { walletName: DEPOSIT_WALLET, accounts: WALLET_ACCOUNTS },
    });
    // Find it the same way a re-run would, rather than trusting the response.
    subOrgId = await findCustomerOrgId(parent, parentOrgId);
    if (!subOrgId) {
      throw new Error(
        "created the sub-org but can't find it yet; re-run `pnpm onboard-customer`",
      );
    }
    console.log(`${C.green}+${C.reset} created sub-org ${subOrgId}`);
  }

  // ── Customer: Earn wallet, delegated user, policies ──────────────────────
  header("Grant the platform's delegated user its rights", USER_TAG);
  const { client: customer } = newClient("CUSTOMER", subOrgId);

  const { wallets } = await customer.getWallets({ organizationId: subOrgId });
  if (wallets.some((w) => w.walletName === EARN_WALLET)) {
    console.log(`${C.green}✓${C.reset} existing ${EARN_WALLET}`);
  } else {
    await customer.createWallet({
      organizationId: subOrgId,
      walletName: EARN_WALLET,
      accounts: WALLET_ACCOUNTS,
    });
    console.log(`${C.green}+${C.reset} created ${EARN_WALLET}`);
  }

  const { users } = await customer.getUsers({ organizationId: subOrgId });
  let delegatedUserId = users.find((u) =>
    u.apiKeys.some((k) => k.credential.publicKey === delegatedPublicKey),
  )?.userId;
  if (delegatedUserId) {
    console.log(
      `${C.green}✓${C.reset} existing delegated user ${delegatedUserId}`,
    );
  } else {
    // createUsers never adds a user to the root quorum, so the delegated user
    // is non-root from the moment it exists.
    const { userIds } = await customer.createUsers({
      organizationId: subOrgId,
      users: [
        {
          userName: "Platform delegated user",
          apiKeys: [
            {
              apiKeyName: "platform-delegated-key",
              publicKey: delegatedPublicKey,
              curveType: "API_KEY_CURVE_P256",
            },
          ],
          authenticators: [],
          oauthProviders: [],
          userTags: [],
        },
      ],
    });
    delegatedUserId = userIds[0]!;
    console.log(
      `${C.green}+${C.reset} created delegated user ${delegatedUserId}`,
    );
  }

  // The customer must be the only root user, and the delegated user must not be.
  const { configs } = await customer.getOrganizationConfigs({
    organizationId: subOrgId,
  });
  const rootIds = configs.quorum?.userIds ?? [];
  if (rootIds.includes(delegatedUserId)) {
    throw new Error(
      "the delegated user is in the root quorum; refusing to continue",
    );
  }
  console.log(
    `${C.green}✓${C.reset} root quorum: ${rootIds.length} user(s), threshold ${configs.quorum?.threshold}; delegated user is not root`,
  );

  const c = await loadCustomer(customer, subOrgId);
  console.log(`\n📬 Deposit wallet  EVM ${c.depositEvm}`);
  console.log(`                  Solana ${c.depositSol}`);
  console.log(`💼 Earn wallet     EVM ${c.earnEvm}`);
  console.log(`                  Solana ${c.earnSol}\n`);

  const lists = await supportedAssets(customer, subOrgId);
  printAssetLists(lists);
  if (lists.targets.length === 0) {
    throw new Error(
      "no enabled vaults for any input asset; enable a stablecoin vault in the dashboard first",
    );
  }

  const desired = buildPolicies(c, delegatedUserId, lists);
  const { policies: existing } = await customer.getPolicies({
    organizationId: subOrgId,
  });

  const toCreate = [];
  for (const spec of desired) {
    const current = existing.find((p) => p.policyName === spec.policyName);
    if (!current) {
      toCreate.push(spec);
    } else if (
      current.condition !== spec.condition ||
      current.consensus !== spec.consensus
    ) {
      await customer.updatePolicy({
        organizationId: subOrgId,
        policyId: current.policyId,
        policyCondition: spec.condition,
        policyConsensus: spec.consensus,
        policyNotes: spec.notes,
      });
      console.log(`${C.green}~${C.reset} updated policy "${spec.policyName}"`);
    } else {
      console.log(`${C.green}✓${C.reset} policy "${spec.policyName}"`);
    }
  }
  if (toCreate.length > 0) {
    await customer.createPolicies({
      organizationId: subOrgId,
      policies: toCreate,
    });
    for (const spec of toCreate) {
      console.log(`${C.green}+${C.reset} created policy "${spec.policyName}"`);
    }
  }

  console.log(`\n${C.bold}Policies for the delegated user:${C.reset}`);
  for (const spec of desired) {
    console.log(`\n  ${C.bold}${spec.policyName}${C.reset}`);
    console.log(`  ${C.dim}${spec.condition}${C.reset}`);
  }

  console.log(
    `\n✅ Customer onboarded. Run \`pnpm watch\`, then send stablecoins to the Earn wallet (or fund the deposit wallet and move them with \`pnpm customer-send\`).`,
  );
  console.log(
    `${C.dim}Earn chains with enabled vaults: ${[...new Set(lists.targets.map((t) => chainName(t.caip2)))].join(", ")}${C.reset}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
