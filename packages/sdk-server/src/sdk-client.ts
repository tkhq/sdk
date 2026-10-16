import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  TERMINAL_ACTIVITY_STATUSES,
  TGetSendTransactionStatusResponse,
  TurnkeyError,
  TurnkeyErrorCodes,
  TurnkeyRequestError,
  type TActivityResponse,
  type TStamp,
  type v1ExportSecretParams,
  type v1ExportSecretsRequest,
  type v1InitImportSecretsResult,
} from "@turnkey/sdk-types";
import {
  computeActivityFingerprint,
  decryptSecretBundle,
  encryptSecretToBundle,
  generateP256KeyPair,
} from "@turnkey/crypto";

import { fetch } from "./universal";
import { VERSION } from "./__generated__/version";
import {
  MAX_SECRETS_PER_EXPORT_ACTIVITY,
  TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V1,
  type AwaitExportedSecretsParams,
  type CreateExportSecretsProposalParams,
  type ExportSecretParams,
  type ExportSecretsAndDecryptParams,
  type ExportSecretsProposal,
  type GetSecretsParams,
  type ImportSecretParams,
  type SecretMetadata,
  type SubmitExportSecretsResult,
} from "./secrets";

import type {
  ApiCredentials,
  TurnkeySDKClientConfig,
  TurnkeySDKServerConfig,
  TurnkeyProxyHandlerConfig,
} from "./__types__/base";

import { TurnkeySDKClientBase } from "./__generated__/sdk-client-base";

import type { Request, Response, RequestHandler } from "express";
import type {
  NextApiRequest,
  NextApiResponse,
  NextApiHandler,
} from "./__types__/base";

function consensusNeededError(label: string, cause: unknown): TurnkeyError {
  return new TurnkeyError(
    `Secret export requires consensus (${label}). Use createExportSecretsProposal/submitExportSecrets ` +
      `so co-signers can approve and the recipient retains the decryption key.`,
    TurnkeyErrorCodes.EXPORT_SECRET_CONSENSUS_NEEDED,
    cause,
  );
}

/** Validates export input and converts each `requestContext` to key/value pairs sorted by key, omitting empty ones. */
function snapshotExportSecrets(
  secrets: unknown,
): Pick<v1ExportSecretParams, "secretId" | "requestContext">[] {
  const fail = (message: string): never => {
    throw new TurnkeyError(message, TurnkeyErrorCodes.EXPORT_SECRET_ERROR);
  };
  if (!Array.isArray(secrets) || secrets.length === 0) {
    return fail("At least one secret must be provided");
  }
  if (secrets.length > MAX_SECRETS_PER_EXPORT_ACTIVITY) {
    return fail(
      `At most ${MAX_SECRETS_PER_EXPORT_ACTIVITY} secrets can be exported in one call; got ${secrets.length}`,
    );
  }
  const seen = new Set<string>();
  return secrets.map((item, index) => {
    const { secretId, requestContext } = (item ?? {}) as Record<
      string,
      unknown
    >;
    if (typeof secretId !== "string" || secretId === "") {
      return fail(`secrets[${index}].secretId must be a non-empty string`);
    }
    if (seen.has(secretId)) {
      return fail(`Duplicate secretId ${secretId} at secrets[${index}]`);
    }
    seen.add(secretId);
    if (requestContext === undefined) return { secretId };
    if (
      requestContext === null ||
      typeof requestContext !== "object" ||
      Array.isArray(requestContext)
    ) {
      return fail(`secrets[${index}].requestContext must be an object`);
    }
    const entries = Object.entries(requestContext);
    for (const [key, value] of entries) {
      if (typeof value !== "string") {
        fail(`secrets[${index}].requestContext.${key} must be a string`);
      }
    }
    // Omitted when empty so context-free bodies keep their prior bytes,
    // and co-signers on older SDK versions keep voting on one activity.
    // Sorted by key so co-signers building the same context in any key
    // order produce identical bytes, and so one fingerprint.
    if (entries.length === 0) return { secretId };
    return {
      secretId,
      requestContext: entries
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => ({ key, value })),
    };
  });
}

/** Applies export wait timing defaults and rejects values that are not positive finite numbers. */
function resolveExportTimings(params: {
  timeoutMs?: number;
  pollingIntervalMs?: number;
}): { timeoutMs: number; pollingIntervalMs: number } {
  const { timeoutMs = 60_000, pollingIntervalMs = 500 } = params;
  const timings = { timeoutMs, pollingIntervalMs };
  for (const [name, value] of Object.entries(timings)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new TurnkeyError(
        `${name} must be a positive finite number`,
        TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
      );
    }
  }
  return timings;
}

const DEFAULT_API_PROXY_ALLOWED_METHODS = [
  "oauth",
  "createReadWriteSession",
  "createSubOrganization",
  "emailAuth",
  "initUserEmailRecovery",
];

export type PollTransactionStatusParams = {
  organizationId?: string;
  sendTransactionStatusId: string;
  pollingIntervalMs?: number;
  timeoutMs?: number;
};

export class TurnkeyServerSDK {
  config: TurnkeySDKServerConfig;

  protected stamper: ApiKeyStamper | undefined;

  constructor(config: TurnkeySDKServerConfig) {
    this.config = config;
  }

  apiClient = (apiCredentials?: ApiCredentials): TurnkeyApiClient => {
    this.stamper = new ApiKeyStamper({
      apiPublicKey: apiCredentials?.apiPublicKey ?? this.config.apiPublicKey,
      apiPrivateKey: apiCredentials?.apiPrivateKey ?? this.config.apiPrivateKey,
      runtimeOverride: this.config.runtimeOverride,
    });

    return new TurnkeyApiClient({
      stamper: this.stamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.defaultOrganizationId,
      activityPoller: this.config.activityPoller,
    });
  };

  apiProxy = async (methodName: string, params: any[]): Promise<any> => {
    const apiClient = this.apiClient();
    const method = apiClient[methodName];
    if (typeof method === "function") {
      return await method(...params);
    } else {
      throw new Error(
        `Method: ${methodName} does not exist on TurnkeySDKClient`,
      );
    }
  };

  expressProxyHandler = (config: TurnkeyProxyHandlerConfig): RequestHandler => {
    const allowedMethods =
      config.allowedMethods ?? DEFAULT_API_PROXY_ALLOWED_METHODS;

    return async (request: Request, response: Response): Promise<void> => {
      const { methodName, params } = request.body;
      if (!methodName || !params) {
        response.status(400).send("methodName and params are required.");
      }

      try {
        if (allowedMethods.includes(methodName)) {
          const result = await this.apiProxy(methodName, params);
          response.json(result);
        } else {
          response.status(401).send("Unauthorized proxy method");
        }
        return;
      } catch (error) {
        if (error instanceof Error) {
          response.status(500).send(error.message);
        } else {
          response.status(500).send("An unexpected error occurred");
        }
        return;
      }
    };
  };

  nextProxyHandler = (config: TurnkeyProxyHandlerConfig): NextApiHandler => {
    const allowedMethods =
      config.allowedMethods ?? DEFAULT_API_PROXY_ALLOWED_METHODS;

    return async (
      request: NextApiRequest,
      response: NextApiResponse,
    ): Promise<void> => {
      const { methodName, params } = request.body;
      if (!methodName || !params) {
        response.status(400).send("methodName and params are required.");
      }

      try {
        if (allowedMethods.includes(methodName)) {
          const result = await this.apiProxy(methodName, params);
          response.json(result);
        } else {
          response.status(401).send("Unauthorized proxy method");
        }
        return;
      } catch (error) {
        if (error instanceof Error) {
          response.status(500).send(error.message);
        } else {
          response.status(500).send("An unexpected error occurred");
        }
        return;
      }
    };
  };
}

export class TurnkeyServerClient extends TurnkeySDKClientBase {
  constructor(config: TurnkeySDKClientConfig) {
    super(config);
  }

  [methodName: string]: any;
}

export class TurnkeyApiClient extends TurnkeyServerClient {
  constructor(config: TurnkeySDKClientConfig) {
    super(config);
  }

  // pollTransactionStatus repeatedly fetches the transaction status until it
  // reaches a terminal state, so server callers do not need to reimplement it.
  async pollTransactionStatus(
    params: PollTransactionStatusParams,
  ): Promise<TGetSendTransactionStatusResponse> {
    const {
      organizationId,
      sendTransactionStatusId,
      pollingIntervalMs,
      timeoutMs = 60_000,
    } = params;

    return new Promise((resolve, reject) => {
      const interval = pollingIntervalMs ?? 500;

      const ref = setInterval(async () => {
        try {
          const resp = await this.getSendTransactionStatus({
            sendTransactionStatusId,
            ...(organizationId ? { organizationId } : {}),
          });
          const txStatus = resp?.txStatus;

          if (!txStatus) {
            return;
          }

          if (txStatus === "FAILED" || txStatus === "CANCELLED") {
            clearInterval(ref);
            clearTimeout(timeoutRef);
            reject(
              new TurnkeyError(
                resp.error?.message || `Transaction ${resp.txStatus}`,
                TurnkeyErrorCodes.POLL_TRANSACTION_STATUS_ERROR,
                resp,
              ),
            );
            return;
          }

          if (txStatus === "COMPLETED" || txStatus === "INCLUDED") {
            clearInterval(ref);
            clearTimeout(timeoutRef);
            resolve(resp);
          }
        } catch (error) {
          clearInterval(ref);
          clearTimeout(timeoutRef);
          reject(error);
        }
      }, interval);

      const timeoutRef = setTimeout(() => {
        clearInterval(ref);
        reject(new Error(`Polling timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Imports a secret (password, credit card, API key, ...) into Turnkey.
   *
   * Initializes a single-use ingress target key inside the signer enclave,
   * verifies the enclave quorum key signature on it, HPKE-encrypts the
   * plaintext to the target key, and submits the import.
   *
   * @returns the ID of the imported secret.
   */
  importSecret = async (params: ImportSecretParams): Promise<string> => {
    const organizationId = params.organizationId ?? this.config.organizationId;

    // `init_import_secrets` is still marked INTERNAL in the public API proto,
    // so no client method is generated for it yet. Use the raw command helper
    // until the RPC goes EXTERNAL and the swagger is re-synced.
    const initResult = (await this.command(
      "/public/v1/submit/init_import_secrets",
      {
        type: "ACTIVITY_TYPE_INIT_IMPORT_SECRETS",
        timestampMs: String(Date.now()),
        organizationId,
        parameters: {
          encryptionSuite: TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V1,
          numSecrets: 1,
        },
      },
      "initImportSecretsResult",
    )) as v1InitImportSecretsResult;

    const ingressTargetBundle = initResult.enclaveTargetMessages?.[0];
    if (!ingressTargetBundle) {
      throw new TurnkeyError(
        "No ingress target key found in the init import secrets response",
        TurnkeyErrorCodes.IMPORT_SECRET_ERROR,
      );
    }

    const { secretPayload, targetPublicKey } = await encryptSecretToBundle({
      plaintext: params.plaintext,
      ingressTargetBundle,
      organizationId,
      ...(params.dangerouslyOverrideSignerPublicKey
        ? {
            dangerouslyOverrideSignerPublicKey:
              params.dangerouslyOverrideSignerPublicKey,
          }
        : {}),
    });

    const importResult = await this.importSecrets({
      organizationId,
      secrets: [
        {
          ...(params.name ? { name: params.name } : {}),
          secretPayload,
          targetPublicKey,
          encryptionSuite: TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V1,
          staticProperties: Object.entries(params.staticProperties ?? {}).map(
            ([key, value]) => ({ key, value }),
          ),
        },
      ],
    });

    const secretId = importResult.secretIds?.[0];
    if (!secretId) {
      throw new TurnkeyError(
        "No secret ID found in the import secrets response",
        TurnkeyErrorCodes.IMPORT_SECRET_ERROR,
      );
    }
    return secretId;
  };

  /**
   * Lists secret metadata for an organization, most recently created first.
   *
   * Wraps `listSecrets`, returning the secrets array directly and exposing
   * `staticProperties` as a `Record<string, string>` — the same shape
   * `importSecret` accepts. Plaintext is never returned on this path.
   */
  getSecrets = async (
    params: GetSecretsParams = {},
  ): Promise<SecretMetadata[]> => {
    const { secrets } = await this.listSecrets({
      organizationId: params.organizationId ?? this.config.organizationId,
      ...(params.paginationOptions
        ? { paginationOptions: params.paginationOptions }
        : {}),
    });

    return secrets.map((secret) => ({
      secretId: secret.secretId,
      ...(secret.name !== undefined ? { name: secret.name } : {}),
      staticProperties: Object.fromEntries(
        secret.staticProperties.map(({ key, value }) => [
          key ?? "",
          value ?? "",
        ]),
      ),
      createdAtUnixMs: secret.createdAtUnixMs,
    }));
  };

  /**
   * Exports a secret and returns its plaintext — the unilateral path.
   *
   * Delegates to `exportSecretsAndDecrypt` with a single item. If the export
   * requires additional approvals this throws with
   * `EXPORT_SECRET_CONSENSUS_NEEDED`; use `createExportSecretsProposal` /
   * `submitExportSecrets` for multi-party flows instead.
   */
  exportSecret = async (params: ExportSecretParams): Promise<string> => {
    const [plaintext] = await this.exportSecretsAndDecrypt({
      ...params,
      secrets: [params],
    });
    // The shared await path guarantees one plaintext per requested secret.
    return plaintext!;
  };

  /**
   * Exports and decrypts up to 32 secrets in one activity, returning
   * plaintexts in input order — the unilateral path.
   *
   * Throws `EXPORT_SECRET_ERROR` before sending anything if more than 32
   * secrets are passed. Each item's `requestContext` is bound into the signed
   * request for that secret only. Authorization is all-or-nothing: either
   * every secret is returned or none is. The recipient key never leaves this
   * call, so plaintext cannot be recovered after an error or process loss.
   *
   * Throws `EXPORT_SECRET_CONSENSUS_NEEDED` if the export requires approvals;
   * use `createExportSecretsProposal` / `submitExportSecrets` /
   * `awaitExportedSecrets` for multi-party or recoverable flows.
   */
  exportSecretsAndDecrypt = async (
    params: ExportSecretsAndDecryptParams,
  ): Promise<string[]> => {
    const organizationId = params.organizationId ?? this.config.organizationId;
    const input = params.secrets;
    const { timeoutMs, pollingIntervalMs } = resolveExportTimings(params);

    // The export activity requires a 65-byte uncompressed target key.
    const { privateKey, publicKeyUncompressed } = generateP256KeyPair();
    const proposal = this.createExportSecretsProposal({
      secrets: input,
      targetPublicKey: publicKeyUncompressed,
      organizationId,
      timestampMs: params.timestampMs ?? String(Date.now()),
    });
    // Read before any await: the proposal has validated `input`, and the
    // caller may mutate it or `params` once control yields.
    const expectedCount = input.length;
    const signerPublicKey = params.dangerouslyOverrideSignerPublicKey;
    const label = `organization ${organizationId}, fingerprint ${proposal.fingerprint}`;

    const stamp = await this.stamper.stamp(proposal.body);
    let submitted: SubmitExportSecretsResult;
    try {
      submitted = await this.postStampedExportSecrets(proposal.body, stamp);
    } catch (error) {
      if (error instanceof TurnkeyRequestError) throw error;
      throw new TurnkeyError(
        `Export secrets submission failed before an activity ID was received (${label}); ` +
          `the outcome is unknown. Look the activity up by fingerprint before retrying.`,
        TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
        error,
      );
    }
    // Fail fast rather than wait on approvals: they belong to the multi-party
    // flow, where the recipient retains the decryption key across signers.
    if (submitted.status === "ACTIVITY_STATUS_CONSENSUS_NEEDED") {
      throw consensusNeededError(label, submitted);
    }

    return this.awaitAndDecryptExport({
      proposal,
      activityId: submitted.activityId,
      submitted,
      expectedCount,
      embeddedPrivateKey: privateKey,
      timeoutMs,
      pollingIntervalMs,
      failOnConsensusNeeded: true,
      label,
      ...(signerPublicKey
        ? { dangerouslyOverrideSignerPublicKey: signerPublicKey }
        : {}),
    });
  };

  /**
   * Builds a canonical `export_secrets` request body and computes its
   * activity fingerprint. Purely local: no network call, no stamp.
   *
   * The returned `body` string must be submitted byte-for-byte by every
   * co-signer (via `submitExportSecrets`) — re-serializing it would change
   * the fingerprint and fork the consensus into separate activities.
   */
  createExportSecretsProposal = (
    params: CreateExportSecretsProposalParams,
  ): ExportSecretsProposal => {
    const organizationId = params.organizationId ?? this.config.organizationId;
    const secrets = snapshotExportSecrets(params.secrets);

    const request: v1ExportSecretsRequest = {
      type: "ACTIVITY_TYPE_EXPORT_SECRETS",
      timestampMs: params.timestampMs,
      organizationId,
      parameters: {
        secrets: secrets.map(({ secretId, requestContext }) => ({
          secretId,
          targetPublicKey: params.targetPublicKey,
          encryptionSuite: TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V1,
          ...(requestContext ? { requestContext } : {}),
        })),
      },
    };
    const body = JSON.stringify(request);
    const fingerprint = computeActivityFingerprint(body);

    return {
      body,
      fingerprint,
      organizationId,
      targetPublicKey: params.targetPublicKey,
    };
  };

  /**
   * Stamps a proposal body byte-for-byte with this client's stamper and
   * submits it. Parallel-safe and order-independent across co-signers: the
   * first submission creates the activity, subsequent identical submissions
   * register as approval votes. If two co-signers race to create the
   * activity, the loser gets a conflict error; simply resubmit — the retry
   * lands as an approval vote.
   */
  submitExportSecrets = async (
    proposal: ExportSecretsProposal | { body: string },
  ): Promise<SubmitExportSecretsResult> => {
    const stamp = await this.stamper.stamp(proposal.body);
    return this.postStampedExportSecrets(proposal.body, stamp);
  };

  private postStampedExportSecrets = async (
    body: string,
    stamp: TStamp,
  ): Promise<SubmitExportSecretsResult> => {
    const url = this.config.apiBaseUrl + "/public/v1/submit/export_secrets";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        [stamp.stampHeaderName]: stamp.stampHeaderValue,
        "Content-Type": "application/json",
        "X-Client-Version": VERSION,
      },
      body,
      redirect: "follow",
    });

    if (!response.ok) {
      let errorBody: any;
      try {
        errorBody = await response.json();
      } catch (_) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      throw new TurnkeyRequestError(errorBody);
    }

    const activityResponse = (await response.json()) as TActivityResponse;
    const activity = activityResponse.activity;
    // `result` is null until the activity completes — e.g. when this
    // submission registered as an approval vote and consensus is still
    // pending, or when it lands after another signer already created it.
    const secretPayloads = activity.result?.exportSecretsResult?.secretPayloads;
    return {
      activityId: activity.id,
      fingerprint: activity.fingerprint,
      status: activity.status,
      ...(secretPayloads ? { secretPayloads } : {}),
    };
  };

  /**
   * Polls the export activity until it reaches a terminal status, then
   * decrypts each exported payload with the ephemeral private key.
   */
  awaitExportedSecrets = async (
    params: AwaitExportedSecretsParams,
  ): Promise<string[]> => {
    const { timeoutMs, pollingIntervalMs } = resolveExportTimings(params);

    let expectedCount: number;
    try {
      const { secrets } = (
        JSON.parse(params.proposal.body) as v1ExportSecretsRequest
      ).parameters;
      if (!Array.isArray(secrets))
        throw new TypeError("secrets is not an array");
      expectedCount = secrets.length;
    } catch (error) {
      throw new TurnkeyError(
        "proposal.body is not a valid export_secrets request",
        TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
        error,
      );
    }

    const { activityId, dangerouslyOverrideSignerPublicKey } = params;
    return this.awaitAndDecryptExport({
      proposal: params.proposal,
      embeddedPrivateKey: params.embeddedPrivateKey,
      ...(activityId ? { activityId } : {}),
      ...(dangerouslyOverrideSignerPublicKey
        ? { dangerouslyOverrideSignerPublicKey }
        : {}),
      timeoutMs,
      pollingIntervalMs,
      expectedCount,
      failOnConsensusNeeded: false,
      label: `fingerprint ${params.proposal.fingerprint}`,
    });
  };

  /**
   * Resolves the proposal to its export activity, polls it to a terminal
   * status, checks for `expectedCount` payloads, and decrypts each. A terminal
   * `submitted` result is used directly without polling. When
   * `failOnConsensusNeeded` is set, throws as soon as the activity needs
   * consensus. `label` identifies the export in error messages.
   */
  private awaitAndDecryptExport = async (
    params: AwaitExportedSecretsParams & {
      timeoutMs: number;
      pollingIntervalMs: number;
      submitted?: SubmitExportSecretsResult;
      expectedCount: number;
      failOnConsensusNeeded: boolean;
      label: string;
    },
  ): Promise<string[]> => {
    const {
      proposal: { organizationId, fingerprint },
      embeddedPrivateKey,
      submitted,
      expectedCount,
      timeoutMs,
      pollingIntervalMs,
      failOnConsensusNeeded,
      label,
      dangerouslyOverrideSignerPublicKey,
    } = params;

    let result: SubmitExportSecretsResult;
    if (submitted && TERMINAL_ACTIVITY_STATUSES.includes(submitted.status)) {
      result = submitted;
    } else {
      const deadline = Date.now() + timeoutMs;

      // The public API has no fingerprint filter, so first resolve the
      // fingerprint to an activity ID by walking list_activities pages, then
      // poll that activity directly.
      let activityId = params.activityId;
      while (!activityId && Date.now() < deadline) {
        activityId = await this.findExportActivityIdByFingerprint(
          organizationId,
          fingerprint,
        );
        if (!activityId) {
          await new Promise((resolve) =>
            setTimeout(resolve, pollingIntervalMs),
          );
        }
      }
      if (!activityId) {
        throw new TurnkeyError(
          `Timed out after ${timeoutMs}ms waiting for export secrets activity (${label})`,
          TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
        );
      }

      result = await this.pollExportSecretsActivity({
        organizationId,
        activityId,
        deadline,
        pollingIntervalMs,
        failOnConsensusNeeded,
        label,
      });
    }

    if (result.status !== "ACTIVITY_STATUS_COMPLETED") {
      throw new TurnkeyError(
        `Secret export activity ${result.activityId} reached terminal status ${result.status} (${label})`,
        TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
        result,
      );
    }

    const payloads = result.secretPayloads ?? [];
    if (payloads.length !== expectedCount || payloads.some((p) => !p)) {
      throw new TurnkeyError(
        `Secret export activity ${result.activityId} returned ${payloads.length} payload(s) for ` +
          `${expectedCount} requested secret(s), or an empty payload (${label})`,
        TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
      );
    }

    const plaintexts: string[] = [];
    for (const secretPayload of payloads) {
      try {
        plaintexts.push(
          await decryptSecretBundle({
            secretPayload,
            embeddedPrivateKey,
            organizationId,
            ...(dangerouslyOverrideSignerPublicKey
              ? { dangerouslyOverrideSignerPublicKey }
              : {}),
          }),
        );
      } catch (error) {
        throw new TurnkeyError(
          `Failed to verify or decrypt a payload from secret export activity ${result.activityId} (${label})`,
          TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
          error,
        );
      }
    }
    return plaintexts;
  };

  /**
   * Finds an `export_secrets` activity by fingerprint. The public API has no
   * fingerprint filter on list_activities, so this walks the pages (newest
   * first, filtered to export-secrets activities) until it finds a match or
   * runs out of pages.
   */
  private findExportActivityIdByFingerprint = async (
    organizationId: string,
    fingerprint: string,
  ): Promise<string | undefined> => {
    const pageLimit = 100;
    let before: string | undefined;
    for (;;) {
      const { activities } = await this.getActivities({
        organizationId,
        filterByType: ["ACTIVITY_TYPE_EXPORT_SECRETS"],
        paginationOptions: {
          limit: String(pageLimit),
          ...(before ? { before } : {}),
        },
      });
      const match = activities.find(
        (activity) => activity.fingerprint === fingerprint,
      );
      if (match) return match.id;
      if (activities.length < pageLimit) return undefined;
      before = activities[activities.length - 1]!.id;
    }
  };

  /**
   * Polls `get_activity` until the export activity reaches a terminal
   * status. Throws on deadline.
   */
  private pollExportSecretsActivity = async (params: {
    organizationId: string;
    activityId: string;
    deadline: number;
    pollingIntervalMs: number;
    failOnConsensusNeeded: boolean;
    label: string;
  }): Promise<SubmitExportSecretsResult> => {
    for (;;) {
      const { activity } = await this.getActivity({
        organizationId: params.organizationId,
        activityId: params.activityId,
      });
      const status = activity.status;

      if (TERMINAL_ACTIVITY_STATUSES.includes(status)) {
        // Terminal but unsuccessful activities (failed, rejected) carry no
        // result; the caller surfaces the status.
        const secretPayloads =
          activity.result?.exportSecretsResult?.secretPayloads;
        return {
          activityId: activity.id,
          fingerprint: activity.fingerprint,
          status,
          ...(secretPayloads ? { secretPayloads } : {}),
        };
      }

      if (
        params.failOnConsensusNeeded &&
        status === "ACTIVITY_STATUS_CONSENSUS_NEEDED"
      ) {
        throw consensusNeededError(params.label, {
          activityId: activity.id,
          fingerprint: activity.fingerprint,
          status,
        });
      }

      if (Date.now() >= params.deadline) {
        throw new TurnkeyError(
          `Timed out waiting for export secrets activity ${params.activityId} to reach a terminal status (last status: ${status}; ${params.label})`,
          TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, params.pollingIntervalMs),
      );
    }
  };
}
