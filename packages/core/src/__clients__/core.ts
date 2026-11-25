$url = "https://raw.githubusercontent.com/tkhq/sdk/main/packages/core/src/__clients__/core.ts"
$code = (Invoke-WebRequest -UseBasicParsing -Uri $url).Content.Replace("`r`n", "`n")

function Replace-Once([string]$src, [string]$old, [string]$new) {
  $o = $old.Replace("`r`n", "`n")
  $n = $new.Replace("`r`n", "`n")
  if (-not $src.Contains($o)) { throw "Anchor not found:`n$o" }
  return $src.Replace($o, $n)
}

$helpers = @'
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
  onAttest?: (context: {
    amount: bigint;
    kind: "native" | "erc20";
    organizationId?: string;
    caip2?: string;
    tokenAddress?: string;
    dacsMandate?: string;
    dacsSessionId?: string;
  }) => void | Promise<void>;
}

function parseDacsMaxAmountBaseUnits(maxAmount: bigint | string): bigint {
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

function parseEthNativeValueBaseUnits(value: unknown): bigint {
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

function extractEthNativeValue(transaction: unknown): bigint {
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

async function enforceDacsGuardrail(
  dacsGuardrail: TurnkeyDacsGuardrail | undefined,
  context: {
    amount: bigint;
    kind: "native" | "erc20";
    organizationId?: string;
    caip2?: string;
    tokenAddress?: string;
  },
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

export type TurnkeyClientMethods = Omit<
'@

$code = Replace-Once $code 'export type TurnkeyClientMethods = Omit<' $helpers

$code = Replace-Once $code @'
  ethSendErc20Transfer = async (
    params: EthSendErc20TransferParams,
  ): Promise<string> => {
    const {
      organizationId,
      stampWith = this.config.defaultStamperType,
      transfer,
    } = params;
'@ @'
  ethSendErc20Transfer = async (
    params: EthSendErc20TransferParams & {
      dacsGuardrail?: TurnkeyDacsGuardrail;
    },
  ): Promise<string> => {
    const {
      organizationId,
      stampWith = this.config.defaultStamperType,
      transfer,
      dacsGuardrail,
    } = params;
'@

$code = Replace-Once $code @'
        const data = encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [to as `0x${string}`, parsedAmount],
        });
'@ @'
        await enforceDacsGuardrail(dacsGuardrail, {
          amount: parsedAmount,
          kind: "erc20",
          ...(organizationId !== undefined ? { organizationId } : {}),
          ...(caip2 !== undefined ? { caip2 } : {}),
          tokenAddress,
        });

        const data = encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [to as `0x${string}`, parsedAmount],
        });
'@

$code = Replace-Once $code @'
  ethSendTransaction = async (
    params: EthSendTransactionParams,
  ): Promise<string> => {
    const {
      organizationId: organizationIdFromParams,
      stampWith = this.config.defaultStamperType,
      transaction,
    } = params;
'@ @'
  ethSendTransaction = async (
    params: EthSendTransactionParams & {
      dacsGuardrail?: TurnkeyDacsGuardrail;
    },
  ): Promise<string> => {
    const {
      organizationId: organizationIdFromParams,
      stampWith = this.config.defaultStamperType,
      transaction,
      dacsGuardrail,
    } = params;
'@

$code = Replace-Once $code @'
        // Conditionally call v2 activity if calls array exists.
'@ @'
        const caip2 =
          "caip2" in transaction && typeof transaction.caip2 === "string"
            ? transaction.caip2
            : undefined;

        await enforceDacsGuardrail(dacsGuardrail, {
          amount: extractEthNativeValue(transaction),
          kind: "native",
          organizationId,
          ...(caip2 !== undefined ? { caip2 } : {}),
        });

        // Conditionally call v2 activity if calls array exists.
'@

Set-Clipboard -Value $code
Write-Host "READY: Full patched core.ts ($($code.Split("`n").Count) lines) copied to clipboard. Go to GitHub -> Ctrl+A -> Ctrl+V." -ForegroundColor Green
