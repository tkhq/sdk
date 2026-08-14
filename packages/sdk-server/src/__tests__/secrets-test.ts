import {
  test,
  expect,
  jest,
  describe,
  afterEach,
  beforeEach,
} from "@jest/globals";
import { createHash } from "crypto";
import { ApiKeyStamper, signWithApiKey } from "@turnkey/api-key-stamper";
import {
  formatHpkeBuf,
  generateP256KeyPair,
  hpkeDecrypt,
  hpkeEncrypt,
  verifyStampSignature,
} from "@turnkey/crypto";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";

import { readFixture } from "../__fixtures__/shared";
import { TurnkeyApiClient } from "../sdk-client";
import { fetch } from "../universal";

// `submitExportSecrets` sends through the `cross-fetch` re-export in
// `../universal` (unlike the generated client, which uses the global fetch).
jest.mock("cross-fetch");
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

const ORGANIZATION_ID = "89881fc7-6ff3-4b43-b962-916698f8ff58";

// An in-test P-256 "signer enclave quorum key". Bundles are signed the same
// way the real signer enclave signs them (ECDSA P-256 over sha256 of the
// hex-decoded `data` bytes, DER), and verified against it via
// `dangerouslyOverrideSignerPublicKey`.
const signer = generateP256KeyPair();

/** Builds a signed bundle envelope ({data, dataSignature, enclaveQuorumPublic}). */
const signBundle = async (
  signedFields: Record<string, string>,
): Promise<string> => {
  const json = JSON.stringify(signedFields);
  const dataSignature = await signWithApiKey({
    content: json,
    publicKey: signer.publicKey,
    privateKey: signer.privateKey,
  });
  return JSON.stringify({
    data: Buffer.from(json, "utf8").toString("hex"),
    dataSignature,
    enclaveQuorumPublic: signer.publicKeyUncompressed,
  });
};

const createClient = (): TurnkeyApiClient =>
  new TurnkeyApiClient({
    stamper: {
      stamp: async () => ({
        stampHeaderName: "X-Stamp",
        stampHeaderValue: "stamp",
      }),
    },
    apiBaseUrl: "https://mocked.turnkey.com",
    organizationId: ORGANIZATION_ID,
  });

afterEach(() => {
  mockedFetch.mockReset();
  jest.useRealTimers();
});

describe("createExportSecretsProposal", () => {
  test("computes the activity fingerprint over the exact body and is deterministic across clients", () => {
    const params = {
      secrets: [{ secretId: "secret-1" }, { secretId: "secret-2" }],
      targetPublicKey: "04deadbeef",
      timestampMs: "1755100000000",
    };
    const proposal = createClient().createExportSecretsProposal(params);

    // Independent fingerprint computation over the body bytes.
    const expectedDigest = createHash("sha256")
      .update(proposal.body, "utf8")
      .digest("hex");
    expect(proposal.fingerprint).toBe(`sha256:${expectedDigest}`);
    expect(proposal.organizationId).toBe(ORGANIZATION_ID);
    expect(proposal.targetPublicKey).toBe("04deadbeef");

    const request = JSON.parse(proposal.body);
    expect(request.type).toBe("ACTIVITY_TYPE_EXPORT_SECRETS");
    expect(request.timestampMs).toBe("1755100000000");
    expect(request.organizationId).toBe(ORGANIZATION_ID);
    expect(request.parameters.secrets).toEqual([
      {
        secretId: "secret-1",
        targetPublicKey: "04deadbeef",
        encryptionSuite: "TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V1",
      },
      {
        secretId: "secret-2",
        targetPublicKey: "04deadbeef",
        encryptionSuite: "TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V1",
      },
    ]);

    // Byte-identical body and fingerprint from a different client instance:
    // co-signers computing the proposal locally converge on one activity.
    const other = createClient().createExportSecretsProposal(params);
    expect(other.body).toBe(proposal.body);
    expect(other.fingerprint).toBe(proposal.fingerprint);
  });
});

describe("submitExportSecrets", () => {
  test("stamps the exact proposal body bytes and maps a completed activity", async () => {
    const { privateKey, publicKey } = await readFixture();
    const client = new TurnkeyApiClient({
      stamper: new ApiKeyStamper({
        apiPublicKey: publicKey,
        apiPrivateKey: privateKey,
      }),
      apiBaseUrl: "https://mocked.turnkey.com",
      organizationId: ORGANIZATION_ID,
    });
    const proposal = client.createExportSecretsProposal({
      secrets: [{ secretId: "secret-1" }],
      targetPublicKey: "04deadbeef",
    });

    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        activity: {
          id: "activity-1",
          fingerprint: proposal.fingerprint,
          status: "ACTIVITY_STATUS_COMPLETED",
          result: {
            exportSecretsResult: { secretPayloads: ["payload-1"] },
          },
        },
      }),
    } as any);

    const result = await client.submitExportSecrets(proposal);
    expect(result).toEqual({
      activityId: "activity-1",
      fingerprint: proposal.fingerprint,
      status: "ACTIVITY_STATUS_COMPLETED",
      secretPayloads: ["payload-1"],
    });

    // The wire body must be the proposal body byte-for-byte, and the stamp
    // must be a valid signature over those exact bytes.
    const [url, init] = mockedFetch.mock.lastCall!;
    expect(url).toBe(
      "https://mocked.turnkey.com/public/v1/submit/export_secrets",
    );
    expect(init?.body).toBe(proposal.body);
    const stampHeader = (init?.headers as Record<string, string>)["X-Stamp"];
    const stamp = JSON.parse(
      Buffer.from(stampHeader!, "base64url").toString("utf8"),
    );
    expect(stamp.publicKey).toBe(publicKey);
    await expect(
      verifyStampSignature(stamp.publicKey, stamp.signature, proposal.body),
    ).resolves.toBe(true);
  });

  test("surfaces JSON and non-JSON HTTP errors", async () => {
    const client = createClient();
    const proposal = { body: '{"type":"ACTIVITY_TYPE_EXPORT_SECRETS"}' };

    mockedFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ code: 7, message: "permission denied" }),
    } as any);
    await expect(client.submitExportSecrets(proposal)).rejects.toThrow(
      "Turnkey error 7: permission denied",
    );

    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => {
        throw new Error("not json");
      },
    } as any);
    await expect(client.submitExportSecrets(proposal)).rejects.toThrow(
      "502 Bad Gateway",
    );
  });
});

describe("importSecret", () => {
  test("encrypts the plaintext to the verified ingress target key and maps params", async () => {
    const client = createClient();
    const target = generateP256KeyPair();

    (client as any).command = jest.fn(async () => ({
      enclaveTargetMessages: [
        await signBundle({
          organizationId: ORGANIZATION_ID,
          targetPublic: target.publicKeyUncompressed,
        }),
      ],
    }));
    let importedSecret: any;
    (client as any).importSecrets = jest.fn(async (body: any) => {
      importedSecret = body.secrets[0];
      return { secretIds: ["secret-123"] };
    });

    const secretId = await client.importSecret({
      plaintext: "hunter2",
      name: "db-password",
      staticProperties: { env: "prod" },
      dangerouslyOverrideSignerPublicKey: signer.publicKeyUncompressed,
    });

    expect(secretId).toBe("secret-123");
    expect(importedSecret.name).toBe("db-password");
    expect(importedSecret.targetPublicKey).toBe(target.publicKeyUncompressed);
    expect(importedSecret.encryptionSuite).toBe(
      "TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V1",
    );
    expect(importedSecret.staticProperties).toEqual([
      { key: "env", value: "prod" },
    ]);

    // The payload decrypts (only) with the ingress target private key.
    const { encappedPublic, ciphertext } = JSON.parse(
      importedSecret.secretPayload,
    );
    const plaintext = new TextDecoder().decode(
      hpkeDecrypt({
        ciphertextBuf: Uint8Array.from(Buffer.from(ciphertext, "hex")),
        encappedKeyBuf: Uint8Array.from(Buffer.from(encappedPublic, "hex")),
        receiverPriv: target.privateKey,
      }),
    );
    expect(plaintext).toBe("hunter2");
  });

  test("fails when the init or import results are missing", async () => {
    const client = createClient();

    (client as any).command = jest.fn(async () => ({
      enclaveTargetMessages: [],
    }));
    await expect(client.importSecret({ plaintext: "x" })).rejects.toThrow(
      "No ingress target key found",
    );

    const target = generateP256KeyPair();
    (client as any).command = jest.fn(async () => ({
      enclaveTargetMessages: [
        await signBundle({
          organizationId: ORGANIZATION_ID,
          targetPublic: target.publicKeyUncompressed,
        }),
      ],
    }));
    (client as any).importSecrets = jest.fn(async () => ({ secretIds: [] }));
    await expect(
      client.importSecret({
        plaintext: "x",
        dangerouslyOverrideSignerPublicKey: signer.publicKeyUncompressed,
      }),
    ).rejects.toThrow("No secret ID found");
  });
});

describe("getSecrets", () => {
  test("maps metadata and staticProperties and passes pagination through", async () => {
    const client = createClient();
    let listParams: any;
    (client as any).listSecrets = jest.fn(async (params: any) => {
      listParams = params;
      return {
        secrets: [
          {
            secretId: "secret-1",
            name: "named",
            staticProperties: [{ key: "env", value: "prod" }],
            createdAtUnixMs: "1755100000000",
          },
          {
            secretId: "secret-2",
            staticProperties: [],
            createdAtUnixMs: "1755100000001",
          },
        ],
      };
    });

    const secrets = await client.getSecrets({
      paginationOptions: { limit: "10", before: "activity-9" },
    });

    expect(listParams).toEqual({
      organizationId: ORGANIZATION_ID,
      paginationOptions: { limit: "10", before: "activity-9" },
    });
    expect(secrets).toEqual([
      {
        secretId: "secret-1",
        name: "named",
        staticProperties: { env: "prod" },
        createdAtUnixMs: "1755100000000",
      },
      {
        secretId: "secret-2",
        staticProperties: {},
        createdAtUnixMs: "1755100000001",
      },
    ]);
    // `name` must be absent, not undefined, for the unnamed secret.
    expect("name" in secrets[1]!).toBe(false);
  });
});

describe("exportSecret", () => {
  test("throws EXPORT_SECRET_CONSENSUS_NEEDED when the activity needs more approvals", async () => {
    const client = createClient();
    const submitted = {
      activityId: "activity-1",
      fingerprint: "sha256:abc",
      status: "ACTIVITY_STATUS_CONSENSUS_NEEDED",
    };
    (client as any).submitExportSecrets = jest.fn(async () => submitted);

    const error = await client
      .exportSecret({ secretId: "secret-1" })
      .then(() => {
        throw new Error("expected exportSecret to reject");
      })
      .catch((e: unknown) => e as TurnkeyError);
    expect(error).toBeInstanceOf(TurnkeyError);
    expect(error.code).toBe(TurnkeyErrorCodes.EXPORT_SECRET_CONSENSUS_NEEDED);
    expect(error.cause).toBe(submitted);
  });

  test("round-trips a secret end to end with an internally generated target key", async () => {
    const client = createClient();
    let proposal: any;
    (client as any).submitExportSecrets = jest.fn(async (p: any) => {
      proposal = p;
      return {
        activityId: "activity-1",
        fingerprint: p.fingerprint,
        status: "ACTIVITY_STATUS_PENDING",
      };
    });
    (client as any).getActivities = jest.fn(async () => ({
      activities: [{ id: "activity-1", fingerprint: proposal.fingerprint }],
    }));
    // Pending on the first poll, then completed with a payload encrypted to
    // the target key exportSecret generated internally.
    let polls = 0;
    (client as any).getActivity = jest.fn(async () => {
      polls += 1;
      if (polls === 1) {
        return {
          activity: {
            id: "activity-1",
            fingerprint: proposal.fingerprint,
            status: "ACTIVITY_STATUS_PENDING",
          },
        };
      }
      const suite = JSON.parse(
        formatHpkeBuf(
          hpkeEncrypt({
            plainTextBuf: new TextEncoder().encode("exported-plaintext"),
            targetKeyBuf: Uint8Array.from(
              Buffer.from(proposal.targetPublicKey, "hex"),
            ),
          }),
        ),
      );
      return {
        activity: {
          id: "activity-1",
          fingerprint: proposal.fingerprint,
          status: "ACTIVITY_STATUS_COMPLETED",
          result: {
            exportSecretsResult: {
              secretPayloads: [
                await signBundle({
                  organizationId: ORGANIZATION_ID,
                  encappedPublic: suite.encappedPublic,
                  ciphertext: suite.ciphertext,
                }),
              ],
            },
          },
        },
      };
    });

    await expect(
      client.exportSecret({
        secretId: "secret-1",
        pollingIntervalMs: 5,
        dangerouslyOverrideSignerPublicKey: signer.publicKeyUncompressed,
      }),
    ).resolves.toBe("exported-plaintext");
    expect(polls).toBe(2);
  });
});

describe("awaitExportedSecrets", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  const proposalFor = (client: TurnkeyApiClient) =>
    client.createExportSecretsProposal({
      secrets: [{ secretId: "secret-1" }],
      targetPublicKey: "04deadbeef",
    });

  test("pages through activities to locate the fingerprint", async () => {
    const client = createClient();
    const proposal = proposalFor(client);

    // A full first page without the fingerprint forces a second page request
    // with `before` set to the last activity of the first page.
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      id: `activity-${i}`,
      fingerprint: `sha256:other-${i}`,
    }));
    const listCalls: any[] = [];
    (client as any).getActivities = jest.fn(async (params: any) => {
      listCalls.push(params);
      if (listCalls.length === 1) return { activities: firstPage };
      return {
        activities: [
          { id: "activity-match", fingerprint: proposal.fingerprint },
        ],
      };
    });
    (client as any).getActivity = jest.fn(async () => ({
      activity: {
        id: "activity-match",
        fingerprint: proposal.fingerprint,
        status: "ACTIVITY_STATUS_FAILED",
      },
    }));

    await expect(
      client.awaitExportedSecrets({
        proposal,
        embeddedPrivateKey: "unused",
        pollingIntervalMs: 5,
      }),
    ).rejects.toThrow("terminal status ACTIVITY_STATUS_FAILED");

    expect(listCalls).toHaveLength(2);
    expect(listCalls[0].paginationOptions).toEqual({ limit: "100" });
    expect(listCalls[1].paginationOptions).toEqual({
      limit: "100",
      before: "activity-99",
    });
  });

  test("times out when the activity never appears", async () => {
    const client = createClient();
    const proposal = proposalFor(client);
    (client as any).getActivities = jest.fn(async () => ({ activities: [] }));

    const result = expect(
      client.awaitExportedSecrets({
        proposal,
        embeddedPrivateKey: "unused",
        timeoutMs: 30,
        pollingIntervalMs: 5,
      }),
    ).rejects.toThrow(
      `Timed out after 30ms waiting for export secrets activity ${proposal.fingerprint}`,
    );
    await jest.advanceTimersByTimeAsync(30);
    await result;
  });

  test("times out when the discovered activity remains nonterminal", async () => {
    const client = createClient();
    const proposal = proposalFor(client);
    (client as any).getActivities = jest.fn(async () => ({
      activities: [
        { id: "activity-pending", fingerprint: proposal.fingerprint },
      ],
    }));
    (client as any).getActivity = jest.fn(async () => ({
      activity: {
        id: "activity-pending",
        fingerprint: proposal.fingerprint,
        status: "ACTIVITY_STATUS_PENDING",
      },
    }));

    const result = expect(
      client.awaitExportedSecrets({
        proposal,
        embeddedPrivateKey: "unused",
        timeoutMs: 30,
        pollingIntervalMs: 5,
      }),
    ).rejects.toThrow(
      "Timed out waiting for export secrets activity activity-pending to reach a terminal status (last status: ACTIVITY_STATUS_PENDING)",
    );
    await jest.advanceTimersByTimeAsync(30);
    await result;
  });
});
