import type { Address } from "viem";

export type X402WalletPolicyInput = {
  walletId: string;
  chainId: number;
  token: Address;
  payer: Address;
  capAtomic: bigint;
  approverCredentialId?: string;
  coApproverUserId?: string;
};

export type X402WalletPolicy = {
  effect: "EFFECT_ALLOW";
  condition: string;
  consensus?: string;
};

/**
 * Builds a Turnkey policy that allows the wallet to sign only EIP-3009
 * `TransferWithAuthorization` typed data for one token on one chain, from
 * `payer`, for at most `capAtomic` per signature. See the README for what it
 * cannot enforce.
 */
export function x402WalletPolicy(
  input: X402WalletPolicyInput,
): X402WalletPolicy {
  const { walletId, chainId, token, payer, capAtomic } = input;
  const ids = [walletId, input.approverCredentialId, input.coApproverUserId];
  if (ids.some((id) => id !== undefined && !UUID.test(id))) {
    throw new Error(
      "walletId, approverCredentialId and coApproverUserId must be Turnkey UUIDs",
    );
  }
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new RangeError(`chainId must be a positive integer, got ${chainId}`);
  }
  if (
    typeof capAtomic !== "bigint" ||
    capAtomic < 0n ||
    capAtomic >= 2n ** 256n
  ) {
    throw new RangeError("capAtomic must be a bigint in the uint256 range");
  }
  const condition = [
    "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'",
    "activity.params.encoding == 'PAYLOAD_ENCODING_EIP712'",
    `wallet.id == '${walletId}'`,
    "eth.eip_712.primary_type == 'TransferWithAuthorization'",
    `eth.eip_712.domain.chain_id == ${chainId}`,
    `eth.eip_712.domain.verifying_contract == '${lowerHexAddress(token)}'`,
    `eth.eip_712.typed_message['from'] == '${lowerHexAddress(payer)}'`,
    `eth.eip_712.typed_message['value'] <= ${capAtomic}`,
  ].join(" && ");
  const approvals = [
    input.approverCredentialId !== undefined &&
      `credentials.any(credential, credential.id == '${input.approverCredentialId}')`,
    input.coApproverUserId !== undefined &&
      `approvers.any(user, user.id == '${input.coApproverUserId}')`,
  ].filter((clause): clause is string => typeof clause === "string");
  return approvals.length === 0
    ? { effect: "EFFECT_ALLOW", condition }
    : { effect: "EFFECT_ALLOW", condition, consensus: approvals.join(" && ") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function lowerHexAddress(address: Address): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`expected a 20-byte hex address, got ${address}`);
  }
  return address.toLowerCase();
}
