import * as dotenv from "dotenv";
import * as path from "path";
import prompts from "prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { Crypto } from "@peculiar/webcrypto";
import { generateP256KeyPair, decryptExportBundle } from "@turnkey/crypto";
if (typeof crypto === "undefined") {
  global.crypto = new Crypto();
}

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const WAITING = [
  "ACTIVITY_STATUS_CONSENSUS_NEEDED",
  "ACTIVITY_STATUS_CREATED",
  "ACTIVITY_STATUS_PENDING",
];

// How long to wait for approvals cast outside this script.
const POLL_INTERVAL_MS = 5_000;
const POLL_ATTEMPTS = 60; // ~5 minutes

type ExportResultKey =
  | "exportWalletResult"
  | "exportPrivateKeyResult"
  | "exportWalletAccountResult";

/**
 * Resolves the export bundle, waiting for approvals if the organization's root
 * quorum (or a consensus policy) requires more votes than the submission itself
 * provided.
 */
async function resolveExportBundle(
  turnkeyClient: Turnkey,
  organizationId: string,
  exportResult: any,
  resultKey: ExportResultKey,
): Promise<string> {
  // Quorum of 1: the activity already completed
  if (exportResult?.exportBundle) {
    return exportResult.exportBundle;
  }

  const submitted = exportResult?.activity;
  if (!submitted) {
    throw new Error(
      `No activity in export response: ${JSON.stringify(exportResult)}`,
    );
  }

  const activityId: string = submitted.id;
  let activity = submitted;

  if (activity.status === "ACTIVITY_STATUS_CONSENSUS_NEEDED") {
    console.log(
      `\n⏳ Activity ${activityId} needs more approvals (root quorum > 1).`,
    );
    console.log(`   fingerprint: ${activity.fingerprint}`);
    console.log(`   votes so far: ${activity.votes?.length ?? 0}\n`);
    console.log(
      `   Approve activity ${activityId} in the dashboard or use the approveActivity api endpoint to approve the fingerprint: ${activity.fingerprint}`,
    );
    console.log(
      `   Keeping the target private key in memory; do not kill this process.\n`,
    );
  }

  // Poll until the activity reaches a final state.
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    activity = (
      await turnkeyClient
        .apiClient()
        .getActivity({ activityId, organizationId })
    ).activity;

    if (activity.status === "ACTIVITY_STATUS_COMPLETED") {
      const bundle = activity.result?.[resultKey]?.exportBundle;
      if (!bundle) {
        throw new Error(
          `Activity ${activityId} completed but ${resultKey}.exportBundle is missing`,
        );
      }
      return bundle;
    }

    if (!WAITING.includes(activity.status)) {
      // FAILED, REJECTED, AUTHENTICATORS_NEEDED
      throw new Error(
        `Activity ${activityId} ended as ${activity.status}: ${JSON.stringify(
          (activity as any).failure ?? {},
        )}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Activity ${activityId} still needs approvals after ${
      (POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000
    }s. Re-run the export once approvers are available — this bundle can no longer be decrypted, because the target key pair only lives for the duration of this process.`,
  );
}

async function main() {
  // The bundle is HPKE-encrypted to `publicKey`, and only `privateKey` can open
  // it. Under consensus this pair has to stay in memory until the last approval
  // lands — see `resolveExportBundle` above.
  const keyPair = generateP256KeyPair();
  const privateKey = keyPair.privateKey;
  const publicKey = keyPair.publicKeyUncompressed;
  const organizationId = process.env.ORGANIZATION_ID!;
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });
  const { exportType } = await prompts([
    {
      type: "text",
      name: "exportType",
      message: `Enter Export Type, either "wallet" or "key" or "account"`,
    },
  ]);

  let exportResult;
  let resultKey: ExportResultKey;
  if (exportType == "wallet") {
    const { walletId } = await prompts([
      {
        type: "text",
        name: "walletId",
        message: `Enter wallet id to export`,
      },
    ]);
    resultKey = "exportWalletResult";
    exportResult = await turnkeyClient.apiClient().exportWallet({
      walletId,
      targetPublicKey: publicKey,
    });
  } else if (exportType == "key") {
    const { privateKeyId } = await prompts([
      {
        type: "text",
        name: "privateKeyId",
        message: `Enter private key id to export`,
      },
    ]);
    resultKey = "exportPrivateKeyResult";
    exportResult = await turnkeyClient.apiClient().exportPrivateKey({
      privateKeyId,
      targetPublicKey: publicKey,
    });
  } else if (exportType == "account") {
    const { address } = await prompts([
      {
        type: "text",
        name: "address",
        message: `Enter address to export`,
      },
    ]);
    resultKey = "exportWalletAccountResult";
    exportResult = await turnkeyClient.apiClient().exportWalletAccount({
      address,
      targetPublicKey: publicKey,
    });
  } else {
    throw new Error(
      `Invalid export type. Enter "wallet" or "key" or "account"`,
    );
  }

  const exportBundle = await resolveExportBundle(
    turnkeyClient,
    organizationId,
    exportResult,
    resultKey,
  );

  const decryptedBundle = await decryptExportBundle({
    exportBundle,
    embeddedKey: privateKey,
    organizationId,
    returnMnemonic: exportType == "wallet",
  });
  // WARNING: Be VERY careful how you handle this bundle, this can be use to import your private keys/mnemonics anywhere and can lead to a potential loss of funds
  console.log(decryptedBundle);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
