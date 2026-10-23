import * as dotenv from "dotenv";
import * as path from "path";
import { Turnkey } from "@turnkey/sdk-server";
import { generateP256KeyPair, decryptExportBundle } from "@turnkey/crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Gate wallet account exports on the account's derivation path with the
// wallet_account.path_indexes / wallet_account.path_hardened policy fields.
// Use a fresh organization: existing policies can change the results below.
async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const apiBaseUrl = process.env.BASE_URL!;
  const suffix = Date.now();

  const root = new Turnkey({
    apiBaseUrl,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  }).apiClient();

  // 0/ Create a non-root tester user. Non-root users can do nothing until a
  // policy allows them to.
  const testerKeyPair = generateP256KeyPair();
  const { userIds } = await root.createUsers({
    users: [
      {
        userName: `tester-${suffix}`,
        apiKeys: [
          {
            apiKeyName: "tester-key",
            publicKey: testerKeyPair.publicKey,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [],
        oauthProviders: [],
        userTags: [],
      },
    ],
  });
  const [userId] = userIds;
  console.log(`Created tester user with id: ${userId}`);

  const tester = new Turnkey({
    apiBaseUrl,
    apiPublicKey: testerKeyPair.publicKey,
    apiPrivateKey: testerKeyPair.privateKey,
    defaultOrganizationId: organizationId,
  }).apiClient();

  // 1/ Create a wallet with accounts on three derivation paths: two fully
  // hardened paths of different depths, and a standard Ethereum path with
  // non-hardened components.
  const { walletId, addresses } = await root.createWallet({
    walletName: `wallet-${suffix}`,
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/8797555'/0'/0'",
        addressFormat: "ADDRESS_FORMAT_COMPRESSED",
      },
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/8797555'/0'/3'/0'",
        addressFormat: "ADDRESS_FORMAT_COMPRESSED",
      },
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/60'/0'/0/0",
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
      },
    ],
  });
  const identityAddress = addresses[0]!;
  const subtreeAddress = addresses[1]!;
  const ethereumAddress = addresses[2]!;
  console.log(`Created wallet with id: ${walletId}`);
  console.log(`- m/8797555'/0'/0'    ${identityAddress}`);
  console.log(`- m/8797555'/0'/3'/0' ${subtreeAddress}`);
  console.log(`- m/44'/60'/0'/0/0    ${ethereumAddress}`);

  // Exports are encrypted to this local target key; decryptExportBundle also
  // verifies the bundle's enclave signature.
  const targetKeyPair = generateP256KeyPair();
  const exportAccount = async (address: string) => {
    const { exportBundle } = await tester.exportWalletAccount({
      address,
      targetPublicKey: targetKeyPair.publicKeyUncompressed,
    });
    return decryptExportBundle({
      exportBundle,
      embeddedKey: targetKeyPair.privateKey,
      organizationId,
      returnMnemonic: false,
    });
  };
  const expectExportDenied = async (address: string) => {
    try {
      await exportAccount(address);
    } catch (error: unknown) {
      console.log(
        `Export of ${address} denied as expected: ${(error as Error).message}`,
      );
      return;
    }
    throw new Error(`export of ${address} should have been denied`);
  };

  // 2/ With no policy in place, the tester cannot export anything.
  await expectExportDenied(subtreeAddress);

  // 3/ Allow the tester to export only accounts in the fully hardened subtree
  // m/8797555'/*'/3'/*'.
  const { policyId } = await root.createPolicy({
    policyName: "Allow exports from the hardened subtree",
    effect: "EFFECT_ALLOW",
    consensus: `approvers.any(u, u.id == '${userId}')`,
    condition:
      `activity.kind == 'EXPORT_WALLET_ACCOUNT'` +
      ` && wallet_account.path_indexes.count() == 4` +
      ` && wallet_account.path_indexes[0] == 8797555` +
      ` && wallet_account.path_indexes[2] == 3` +
      ` && wallet_account.path_hardened.all(h, h == true)`,
    notes: "",
  });
  console.log(`Created subtree ALLOW policy with id: ${policyId}`);

  // 4/ The in-subtree account can now be exported and decrypted locally...
  const subtreeKey = await exportAccount(subtreeAddress);
  console.log(
    `Exported the subtree account (decrypted a ${subtreeKey.length}-character private key) ✅`,
  );

  // 5/ ...but the other accounts still cannot: wrong depth for one, wrong
  // subtree and non-hardened components for the other.
  await expectExportDenied(identityAddress);
  await expectExportDenied(ethereumAddress);

  // 6/ A broad allow admits the Ethereum account...
  await root.createPolicy({
    policyName: "Allow all exports for the tester",
    effect: "EFFECT_ALLOW",
    consensus: `approvers.any(u, u.id == '${userId}')`,
    condition: `activity.kind == 'EXPORT_WALLET_ACCOUNT'`,
    notes: "",
  });
  await exportAccount(ethereumAddress);
  console.log(`Exported the Ethereum account under the broad ALLOW ✅`);

  // 7/ ...until an explicit DENY on its coin type wins over the allow. The
  // identity account stays exportable because the deny does not match it.
  await root.createPolicy({
    policyName: "Deny exporting Ethereum (coin type 60) accounts",
    effect: "EFFECT_DENY",
    consensus: `approvers.any(u, u.id == '${userId}')`,
    condition:
      `activity.kind == 'EXPORT_WALLET_ACCOUNT'` +
      ` && wallet_account.path_indexes[1] == 60`,
    notes: "",
  });
  await expectExportDenied(ethereumAddress);
  await exportAccount(identityAddress);
  console.log(`Exported the identity account (the DENY does not match it) ✅`);

  // 8/ The raw path string is not a policy field (paths contain apostrophes,
  // which policy string literals cannot express) — referencing it is rejected
  // at policy creation time.
  try {
    await root.createPolicy({
      policyName: "Refers to an unsupported field",
      effect: "EFFECT_ALLOW",
      consensus: `approvers.any(u, u.id == '${userId}')`,
      condition: `wallet_account.path == ''`,
      notes: "",
    });
  } catch (error: unknown) {
    console.log(
      `Policy on wallet_account.path rejected as expected: ${(error as Error).message}`,
    );
    console.log("All checks passed ✅");
    return;
  }
  throw new Error("policy on wallet_account.path should have been rejected");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
