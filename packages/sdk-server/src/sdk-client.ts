import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  TERMINAL_ACTIVITY_STATUSES,
  TGetSendTransactionStatusResponse,
  TurnkeyError,
  TurnkeyErrorCodes,
  TurnkeyRequestError,
  type TActivityResponse,
  type v1ExportSecretsRequest,
  type v1InitImportSecretsResult,
} from "@turnkey/sdk-types";
import {
  decryptSecretBundle,
  encryptSecretToBundle,
  generateP256KeyPair,
} from "@turnkey/crypto";
import { sha256 } from "@noble/hashes/sha256";

import { fetch } from "./universal";
import { VERSION } from "./__generated__/version";
import {
  TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V1,
  type AwaitExportedSecretsParams,
  type CreateExportSecretsProposalParams,
  type ExportSecretParams,
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
   * Generates a single-use P-256 target key internally, submits the export
   * activity, polls it to completion, and decrypts the payload. If the export
   * requires additional approvals this throws with
   * `EXPORT_SECRET_CONSENSUS_NEEDED`; use `createExportSecretsProposal` /
   * `submitExportSecrets` for multi-party flows instead.
   */
  exportSecret = async (params: ExportSecretParams): Promise<string> => {
    const organizationId = params.organizationId ?? this.config.organizationId;
    // The export activity requires a 65-byte uncompressed target key.
    const { privateKey, publicKeyUncompressed } = generateP256KeyPair();

    const proposal = this.createExportSecretsProposal({
      secrets: [{ secretId: params.secretId }],
      targetPublicKey: publicKeyUncompressed,
      organizationId,
    });

    const submitted = await this.submitExportSecrets(proposal);
    // Fail fast rather than wait on approvals: they belong to the multi-party
    // flow, where the recipient retains the decryption key across signers.
    if (submitted.status === "ACTIVITY_STATUS_CONSENSUS_NEEDED") {
      throw new TurnkeyError(
        `Secret export requires consensus. Use createExportSecretsProposal/submitExportSecrets ` +
          `so co-signers can approve and the recipient retains the decryption key.`,
        TurnkeyErrorCodes.EXPORT_SECRET_CONSENSUS_NEEDED,
        submitted,
      );
    }

    const [plaintext] = await this.awaitExportedSecrets({
      proposal,
      embeddedPrivateKey: privateKey,
      ...(params.timeoutMs !== undefined
        ? { timeoutMs: params.timeoutMs }
        : {}),
      ...(params.pollingIntervalMs !== undefined
        ? { pollingIntervalMs: params.pollingIntervalMs }
        : {}),
      ...(params.dangerouslyOverrideSignerPublicKey
        ? {
            dangerouslyOverrideSignerPublicKey:
              params.dangerouslyOverrideSignerPublicKey,
          }
        : {}),
    });

    if (plaintext === undefined) {
      throw new TurnkeyError(
        "No secret payload found in the export secrets response",
        TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
      );
    }
    return plaintext;
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

    const request: v1ExportSecretsRequest = {
      type: "ACTIVITY_TYPE_EXPORT_SECRETS",
      timestampMs: params.timestampMs ?? String(Date.now()),
      organizationId,
      parameters: {
        secrets: params.secrets.map((secret) => ({
          secretId: secret.secretId,
          targetPublicKey: params.targetPublicKey,
          encryptionSuite: TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V1,
        })),
      },
    };
    const body = JSON.stringify(request);

    const fingerprint = `sha256:${Buffer.from(
      sha256(new TextEncoder().encode(body)),
    ).toString("hex")}`;

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
    const body = proposal.body;
    const url = this.config.apiBaseUrl + "/public/v1/submit/export_secrets";

    const stamp = await this.stamper.stamp(body);
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
   * Polls the activity identified by the proposal's fingerprint until it
   * reaches a terminal status, then decrypts each exported payload with the
   * ephemeral private key.
   */
  awaitExportedSecrets = async (
    params: AwaitExportedSecretsParams,
  ): Promise<string[]> => {
    const {
      proposal,
      embeddedPrivateKey,
      timeoutMs = 60_000,
      pollingIntervalMs = 500,
    } = params;

    const deadline = Date.now() + timeoutMs;

    // The public API has no fingerprint filter, so first resolve the
    // fingerprint to an activity ID by walking list_activities pages, then
    // poll that activity directly.
    let activityId: string | undefined;
    while (!activityId && Date.now() < deadline) {
      activityId = await this.findExportActivityIdByFingerprint(
        proposal.organizationId,
        proposal.fingerprint,
      );
      if (!activityId) {
        await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));
      }
    }
    if (!activityId) {
      throw new TurnkeyError(
        `Timed out after ${timeoutMs}ms waiting for export secrets activity ${proposal.fingerprint}`,
        TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
      );
    }

    const result = await this.pollExportSecretsActivity({
      organizationId: proposal.organizationId,
      activityId,
      deadline,
      pollingIntervalMs,
    });

    if (result.status !== "ACTIVITY_STATUS_COMPLETED") {
      throw new TurnkeyError(
        `Secret export activity reached terminal status ${result.status}`,
        TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
        result,
      );
    }

    const plaintexts: string[] = [];
    for (const secretPayload of result.secretPayloads ?? []) {
      plaintexts.push(
        await decryptSecretBundle({
          secretPayload,
          embeddedPrivateKey,
          organizationId: proposal.organizationId,
          ...(params.dangerouslyOverrideSignerPublicKey
            ? {
                dangerouslyOverrideSignerPublicKey:
                  params.dangerouslyOverrideSignerPublicKey,
              }
            : {}),
        }),
      );
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

      if (Date.now() >= params.deadline) {
        throw new TurnkeyError(
          `Timed out waiting for export secrets activity ${params.activityId} to reach a terminal status (last status: ${status})`,
          TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, params.pollingIntervalMs),
      );
    }
  };
}
