import {
  Turnkey,
  TurnkeyApiClient,
  v1WalletAccount,
} from "@turnkey/sdk-server";
import { Curve } from "@turnkey/core";
import { uint8ArrayFromHexString } from "@turnkey/encoding";
import { createLedgerApiClient, LedgerApiClient } from "@/api/ledger/client";
import { v7 as uuidv7 } from "uuid";
import { main_package_id as mainPackageId } from "@generated/dar/canton.dar.json";
import { Token } from "@generated/daml/canton-1.0.0";
import { readFileSync } from "fs";
import assert from "node:assert";
import { PreparedTransactionSchema } from "@generated/proto/com/daml/ledger/api/v2/interactive/interactive_submission_service_pb";
import { fromBinary } from "@bufbuild/protobuf";
import { hashPreparedTransactionV2 } from "@/hashing/v2";
import { hashPreparedTransactionV3 } from "@/hashing/v3";

const API_URL = process.env.DPK_SANDBOX_API_URL || "http://localhost:6864";

const ALICE_WALLET_NAME = "Canton E2E Wallet - Alice";

const CANTON_DAR_PATH = "./src/__generated__/dar/canton.dar";

describe("Signing", () => {
  let turnkey: Turnkey;
  let client: TurnkeyApiClient;
  let ledgerClient: LedgerApiClient;

  let aliceWalletAccounts: WalletAccounts;

  beforeAll(async () => {
    assert(
      typeof process.env.API_PRIVATE_KEY === "string",
      "Missing required env var: API_PRIVATE_KEY",
    );
    assert(
      typeof process.env.API_PUBLIC_KEY === "string",
      "Missing required env var: API_PUBLIC_KEY",
    );
    assert(
      typeof process.env.ORGANIZATION_ID === "string",
      "Missing required env var: ORGANIZATION_ID",
    );

    const apiBaseUrl = process.env.BASE_URL || "https://api.turnkey.com";
    const apiPrivateKey = process.env.API_PRIVATE_KEY;
    const apiPublicKey = process.env.API_PUBLIC_KEY;
    const organizationId = process.env.ORGANIZATION_ID;

    turnkey = new Turnkey({
      apiBaseUrl,
      apiPrivateKey,
      apiPublicKey,
      defaultOrganizationId: organizationId,
    });
    client = turnkey.apiClient();

    ledgerClient = createLedgerApiClient({ baseUrl: API_URL });

    const getWalletIdByName = createGetWalletIdByName(client);
    const createWallet = createWalletFactory(client);
    const getWalletAccounts = createGetWalletAccounts(client);

    const aliceWalletId =
      (await getWalletIdByName(ALICE_WALLET_NAME)) ??
      (await createWallet(ALICE_WALLET_NAME));

    aliceWalletAccounts = await getWalletAccounts(aliceWalletId);
  });

  it("should sign a transaction hash using ED25519", async () => {
    const synchronizerId = await createGetDefaultSynchronizerId(ledgerClient)();

    const keyData = Buffer.from(
      aliceWalletAccounts.ed25519Account.publicKey!,
      "hex",
    ).toString("base64");

    const partyTopology = await createGeneratePartyTopology(ledgerClient)(
      synchronizerId,
      keyData,
    );

    const signMultiHashPayload = Buffer.from(
      partyTopology!.multiHash,
      "base64",
    ).toString("hex");
    const signedMultiHashPayload = await client.signRawPayload({
      signWith: aliceWalletAccounts.ed25519Account.address,
      payload: signMultiHashPayload,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    });
    const signatureMultiHashPayload = uint8ArrayFromHexString(
      signedMultiHashPayload.r + signedMultiHashPayload.s,
    );

    const { data: allocateData, error: allocateError } =
      await ledgerClient.POST("/v2/parties/external/allocate", {
        body: {
          waitForAllocation: true,
          synchronizer: synchronizerId!,
          onboardingTransactions: partyTopology.topologyTransactions.map(
            (transaction) => ({
              transaction,
            }),
          ),
          multiHashSignatures: [
            {
              format: "SIGNATURE_FORMAT_CONCAT",
              signature: Buffer.from(signatureMultiHashPayload).toString(
                "base64",
              ),
              signedBy: partyTopology.publicKeyFingerprint,
              signingAlgorithmSpec: "SIGNING_ALGORITHM_SPEC_ED25519",
            },
          ],
        },
      });

    expect(allocateError).toBeUndefined();
    expect(allocateData).toBeDefined();

    const partyId = partyTopology.partyId;
    const userId = `user-${uuidv7()}`;
    const { data: userData, error: userError } = await ledgerClient.POST(
      "/v2/users",
      {
        body: {
          user: {
            id: userId,
            partyId,
          },
        },
      },
    );

    expect(userError).toBeUndefined();
    expect(userData).toBeDefined();

    const { data: darData, error: darError } = await ledgerClient.POST(
      "/v2/dars",
      {
        // The types do not allow buffers yet that's what we need to send
        body: readFileSync(CANTON_DAR_PATH) as any,
        bodySerializer: (data) => data, // Pass through the buffer directly without modification
        headers: {
          "Content-Type": "application/octet-stream",
        },
      },
    );

    expect(darError).toBeUndefined();
    expect(darData).toBeDefined();

    const { data: packagesData, error: packagesError } =
      await ledgerClient.GET("/v2/packages");

    expect(packagesError).toBeUndefined();
    expect(packagesData?.packageIds).toContain(mainPackageId);

    const commandIdV2 = `command-${uuidv7()}`;
    const { data: prepareDataV2, error: prepareErrorV2 } =
      await ledgerClient.POST("/v2/interactive-submission/prepare", {
        body: {
          commandId: commandIdV2,
          synchronizerId: synchronizerId!,
          userId,
          actAs: [partyId],
          packageIdSelectionPreference: [mainPackageId],
          hashingSchemeVersion: "HASHING_SCHEME_VERSION_V2",
          commands: [
            {
              CreateCommand: {
                templateId: Token.Token.templateId,
                createArguments: {
                  owner: partyId,
                },
              },
            },
          ],
        },
      });

    expect(prepareErrorV2).toBeUndefined();
    expect(prepareDataV2).toBeDefined();

    const preparedTransactionV2Data = Buffer.from(
      prepareDataV2!.preparedTransaction,
      "base64",
    );
    const preparedTransactionV2 = fromBinary(
      PreparedTransactionSchema,
      preparedTransactionV2Data,
    );
    const hashedPreparedTransactionV2 = hashPreparedTransactionV2(
      preparedTransactionV2,
    );
    const base64HashedPreparedTransactionV2 = Buffer.from(
      hashedPreparedTransactionV2,
    ).toString("base64");

    expect(base64HashedPreparedTransactionV2).toEqual(
      prepareDataV2!.preparedTransactionHash,
    );

    const commandIdV3 = `command-${uuidv7()}`;
    const { data: prepareDataV3, error: prepareErrorV3 } =
      await ledgerClient.POST("/v2/interactive-submission/prepare", {
        body: {
          commandId: commandIdV3,
          synchronizerId: synchronizerId!,
          userId,
          actAs: [partyId],
          packageIdSelectionPreference: [mainPackageId],
          hashingSchemeVersion: "HASHING_SCHEME_VERSION_V3",
          commands: [
            {
              CreateCommand: {
                templateId: Token.Token.templateId,
                createArguments: {
                  owner: partyId,
                },
              },
            },
          ],
        },
      });

    expect(prepareErrorV3).toBeUndefined();
    expect(prepareDataV3).toBeDefined();

    const preparedTransactionV3Data = Buffer.from(
      prepareDataV3!.preparedTransaction,
      "base64",
    );
    const preparedTransactionV3 = fromBinary(
      PreparedTransactionSchema,
      preparedTransactionV3Data,
    );
    const hashedPreparedTransactionV3 = hashPreparedTransactionV3(
      preparedTransactionV3,
    );
    const base64HashedPreparedTransactionV3 = Buffer.from(
      hashedPreparedTransactionV3,
    ).toString("base64");

    const submissionId = `submission-${uuidv7()}`;
    const signCreateContractPayload = Buffer.from(
      base64HashedPreparedTransactionV3,
      "base64",
    ).toString("hex");
    const signedCreateContractPayload = await client.signRawPayload({
      signWith: aliceWalletAccounts.ed25519Account.address,
      payload: signCreateContractPayload,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    });
    const signatureCreateContractPayload = uint8ArrayFromHexString(
      signedCreateContractPayload.r + signedCreateContractPayload.s,
    );
    const { data: createData, error: createError } = await ledgerClient.POST(
      "/v2/interactive-submission/executeAndWaitForTransaction",
      {
        body: {
          preparedTransaction: prepareDataV3!.preparedTransaction,
          submissionId,
          userId,
          hashingSchemeVersion: "HASHING_SCHEME_VERSION_V3",
          deduplicationPeriod: {
            Empty: {},
          },
          partySignatures: {
            signatures: [
              {
                party: partyId,
                signatures: [
                  {
                    format: "SIGNATURE_FORMAT_CONCAT",
                    signature: Buffer.from(
                      signatureCreateContractPayload,
                    ).toString("base64"),
                    signedBy: partyTopology.publicKeyFingerprint,
                    signingAlgorithmSpec: "SIGNING_ALGORITHM_SPEC_ED25519",
                  },
                ],
              },
            ],
          },
        },
      },
    );

    expect(createError).toBeUndefined();
    expect(createData?.transaction).toBeDefined();
  });
});

/**
 * Factory for a function that finds an existing wallet by name
 */
const createGetWalletIdByName =
  (client: TurnkeyApiClient) => async (walletName: string) =>
    client
      .getWallets()
      .then(
        ({ wallets }) =>
          wallets.find((w) => w.walletName === walletName)?.walletId,
      );

/**
 * Factory for a function that creates a wallet by name
 */
const createWalletFactory =
  (client: TurnkeyApiClient) => (walletName: string) =>
    client
      .createWallet({
        walletName,
        accounts: [
          {
            curve: Curve.ED25519,
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/0'/0'/0/0",
            addressFormat: "ADDRESS_FORMAT_COMPRESSED",
          },
        ],
      })
      .then(({ walletId }) => walletId);

interface WalletAccounts {
  walletId: string;
  ed25519Account: v1WalletAccount;
}

/**
 * Factory for a function that finds the accounts needed for tests
 */
const createGetWalletAccounts =
  (client: TurnkeyApiClient) =>
  async (walletId: string): Promise<WalletAccounts> => {
    const { accounts } = await client.getWalletAccounts({
      walletId,
    });

    const ed25519Account = accounts.find(
      ({ curve }) => curve === Curve.ED25519,
    );

    assert(ed25519Account != null, "Missing ED25519 account in wallet");

    return {
      walletId,
      ed25519Account,
    };
  };

const createGetDefaultSynchronizerId =
  (ledgerClient: LedgerApiClient) => async (): Promise<string> => {
    const { data: synchronizersData } = await ledgerClient.GET(
      "/v2/state/connected-synchronizers",
    );
    const synchronizerId =
      synchronizersData?.connectedSynchronizers?.[0]?.synchronizerId;
    expect(synchronizerId).toBeDefined();

    return synchronizerId!;
  };

const createGeneratePartyTopology =
  (ledgerClient: LedgerApiClient) =>
  async (synchronizerId: string, keyData: string) => {
    const { data: partyTopologyData, error: partyTopologyError } =
      await ledgerClient.POST("/v2/parties/external/generate-topology", {
        body: {
          synchronizer: synchronizerId,
          partyHint: `party-${uuidv7()}`,
          publicKey: {
            keySpec: "SIGNING_KEY_SPEC_EC_CURVE25519",
            format: "CRYPTO_KEY_FORMAT_RAW",
            keyData,
          },
        },
      });

    expect(partyTopologyError).toBeUndefined();
    expect(partyTopologyData).toBeDefined();

    return partyTopologyData!;
  };
