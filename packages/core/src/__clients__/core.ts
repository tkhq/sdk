import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import type {
  EthSendErc20TransferParams,
  EthSendTransactionParams,
} from "./__types__";

export interface TurnkeyDacsAttestationContext {
  amount: bigint;
  kind: "native" | "erc20";
  organizationId?: string;
  caip2?: string;
  tokenAddress?: string;
  dacsMandate?: string;
  dacsSessionId?: string;
}

export interface TurnkeyDacsGuardrail {
  /** Optional DACS mandate identifier. */
  dacsMandate?: string;
  /** Optional DACS session identifier. */
  dacsSessionId?: string;
  /**
   * Deterministic pre-flight spend ceiling in base units (bigint or integer string).
   * Enforced whenever supplied, even when `dacsMandate` / `dacsSessionId` are omitted.
   */
  dacsMaxAmount?: bigint | string;
  /**
   * Optional synchronous or async DACS attestation hook invoked before signing and submission.
   * For `ethSendTransaction`, checks inspect aggregate native `value` only (do not decode ABI `data`).
   */
  onAttest?: (context: TurnkeyDacsAttestationContext) => void | Promise<void>;
}

export interface TurnkeyDacsCapableClient {
  ethSendTransaction: (params: EthSendTransactionParams) => Promise<string>;
  ethSendErc20Transfer: (params: EthSendErc20TransferParams) => Promise<string>;
}

export function parseDacsMaxAmountBaseUnits(
  maxAmount: bigint | string,
): bigint {
  if (typeof maxAmount === "bigint") {
    if (maxAmount < 0n) {
      throw new TurnkeyError(
        `[DACS Guardrail] Invalid negative DACS ceiling: ${maxAmount.toString()}`,
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }
    return maxAmount;
  }

  const normalized = maxAmount.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new TurnkeyError(
      `[DACS Guardrail] Invalid DACS ceiling base units: "${maxAmount}"`,
      TurnkeyErrorCodes.INVALID_REQUEST,
    );
  }
  return BigInt(normalized);
}

export function parseEthNativeValueBaseUnits(value: unknown): bigint {
  if (value === undefined || value === null || value === "") {
    return 0n;
  }
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new TurnkeyError(
        `[DACS Guardrail] Invalid negative native value: ${value.toString()}`,
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!/^(0x[0-9a-fA-F]+|\d+)$/.test(normalized)) {
      throw new TurnkeyError(
        `[DACS Guardrail] Invalid native value format: "${value}"`,
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }
    return BigInt(normalized);
  }
  throw new TurnkeyError(
    `[DACS Guardrail] Unsupported native value type: ${typeof value}`,
    TurnkeyErrorCodes.INVALID_REQUEST,
  );
}

/**
 * Extracts aggregate native `value` (wei) from v1 single-call or v2 batched (`calls[]`)
 * Turnkey Ethereum transaction payloads. Does not decode token amounts inside ABI `data`.
 */
export function extractEthNativeValue(transaction: unknown): bigint {
  if (!transaction || typeof transaction !== "object") {
    return 0n;
  }

  if (
    "calls" in transaction &&
    Array.isArray((transaction as { calls?: unknown[] }).calls)
  ) {
    return (transaction as { calls: Array<{ value?: unknown }> }).calls.reduce(
      (sum, call) => sum + parseEthNativeValueBaseUnits(call?.value),
      0n,
    );
  }

  return parseEthNativeValueBaseUnits(
    (transaction as { value?: unknown }).value,
  );
}

/**
 * Deterministic DACS pre-flight spend guardrail and optional attestation hook.
 * Enforces `dacsMaxAmount` whenever provided, independent of mandate/session IDs.
 */
export async function enforceTurnkeyDacsGuardrail(
  dacsGuardrail: TurnkeyDacsGuardrail | undefined,
  context: Omit<TurnkeyDacsAttestationContext, "dacsMandate" | "dacsSessionId">,
): Promise<void> {
  if (!dacsGuardrail) {
    return;
  }

  if (dacsGuardrail.dacsMaxAmount !== undefined) {
    const ceilingBaseUnits = parseDacsMaxAmountBaseUnits(
      dacsGuardrail.dacsMaxAmount,
    );
    if (context.amount > ceilingBaseUnits) {
      throw new TurnkeyError(
        `[DACS Guardrail] Requested ${context.kind} amount (${context.amount.toString()}) exceeds ceiling (${ceilingBaseUnits.toString()}).`,
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }
  }

  if (dacsGuardrail.onAttest) {
    await dacsGuardrail.onAttest({
      amount: context.amount,
      kind: context.kind,
      ...(context.organizationId !== undefined
        ? { organizationId: context.organizationId }
        : {}),
      ...(context.caip2 !== undefined ? { caip2: context.caip2 } : {}),
      ...(context.tokenAddress !== undefined
        ? { tokenAddress: context.tokenAddress }
        : {}),
      ...(dacsGuardrail.dacsMandate !== undefined
        ? { dacsMandate: dacsGuardrail.dacsMandate }
        : {}),
      ...(dacsGuardrail.dacsSessionId !== undefined
        ? { dacsSessionId: dacsGuardrail.dacsSessionId }
        : {}),
    });
  }
}

/**
 * Wraps a `TurnkeyClient` with synchronous DACS pre-flight guardrails for
 * `ethSendTransaction` and `ethSendErc20Transfer` without mutating coordinator payloads.
 */
export function withTurnkeyDacsGuardrail<
  TClient extends TurnkeyDacsCapableClient,
>(client: TClient, defaultGuardrail?: TurnkeyDacsGuardrail) {
  return {
    ethSendTransaction: async (
      params: EthSendTransactionParams & {
        dacsGuardrail?: TurnkeyDacsGuardrail;
      },
    ): Promise<string> => {
      const { dacsGuardrail, ...forwardParams } = params;
      const activeGuardrail = dacsGuardrail ?? defaultGuardrail;
      const caip2 =
        "caip2" in forwardParams.transaction &&
        typeof forwardParams.transaction.caip2 === "string"
          ? forwardParams.transaction.caip2
          : undefined;

      await enforceTurnkeyDacsGuardrail(activeGuardrail, {
        amount: extractEthNativeValue(forwardParams.transaction),
        kind: "native",
        ...(forwardParams.organizationId !== undefined
          ? { organizationId: forwardParams.organizationId }
          : {}),
        ...(caip2 !== undefined ? { caip2 } : {}),
      });

      return client.ethSendTransaction(forwardParams);
    },

    ethSendErc20Transfer: async (
      params: EthSendErc20TransferParams & {
        dacsGuardrail?: TurnkeyDacsGuardrail;
      },
    ): Promise<string> => {
      const { dacsGuardrail, ...forwardParams } = params;
      const activeGuardrail = dacsGuardrail ?? defaultGuardrail;

      let parsedAmount: bigint;
      try {
        parsedAmount = BigInt(forwardParams.transfer.amount);
      } catch {
        throw new TurnkeyError(
          "Invalid ERC20 amount. Use a base-unit integer string.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      await enforceTurnkeyDacsGuardrail(activeGuardrail, {
        amount: parsedAmount,
        kind: "erc20",
        ...(forwardParams.organizationId !== undefined
          ? { organizationId: forwardParams.organizationId }
          : {}),
        ...(forwardParams.transfer.caip2 !== undefined
          ? { caip2: forwardParams.transfer.caip2 }
          : {}),
        tokenAddress: forwardParams.transfer.tokenAddress,
      });

      return client.ethSendErc20Transfer(forwardParams);
    },
  };
}
