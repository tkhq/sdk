import { encodeFunctionData, erc20Abi, type Address } from "viem";
import {
  BASE_SEPOLIA_CAIP2,
  USDC_ADDRESS,
  sweepAssetOf,
  type SweepAsset,
} from "@/lib/deposit";
import { serverEnv } from "@/server/env";
import type { DepositAddressEntry } from "@/server/registry";
import { delegatedClient, type DelegatedClient } from "@/server/turnkey";

export type SweepStatus =
  | "pending"
  | "submitted"
  | "swept"
  | "skipped"
  | "failed";

export type SweepRecord = {
  eventId: string;
  address: Address;
  asset: SweepAsset;
  depositTxHash: string;
  status: SweepStatus;
  amount?: string;
  txHash?: string;
  detail?: string;
  updatedAt: string;
};

const MAX_RECORDS_PER_ADDRESS = 20;

declare global {
  // eslint-disable-next-line no-var
  var __depositSweeps:
    | {
        records: Map<Address, SweepRecord[]>;
        queues: Map<Address, Promise<void>>;
      }
    | undefined;
}

function state() {
  return (globalThis.__depositSweeps ??= {
    records: new Map(),
    queues: new Map(),
  });
}

export function sweepsFor(address: Address): SweepRecord[] {
  return state().records.get(address) ?? [];
}

function update(record: SweepRecord, patch: Partial<SweepRecord>) {
  Object.assign(record, patch, { updatedAt: new Date().toISOString() });
}

// Queues a sweep for one deposit. Sweeps for the same address run one after
// another, so two deposits landing together cannot race on the account's
// nonce, and the second one finds the balance already swept.
export function queueSweep(params: {
  eventId: string;
  entry: DepositAddressEntry;
  asset: SweepAsset;
  depositTxHash: string;
}) {
  const { records, queues } = state();
  const address = params.entry.address;
  const record: SweepRecord = {
    eventId: params.eventId,
    address,
    asset: params.asset,
    depositTxHash: params.depositTxHash,
    status: "pending",
    updatedAt: new Date().toISOString(),
  };
  const list = records.get(address) ?? [];
  list.unshift(record);
  list.length = Math.min(list.length, MAX_RECORDS_PER_ADDRESS);
  records.set(address, list);

  const previous = queues.get(address) ?? Promise.resolve();
  const next = previous.then(() => runSweep(record, params.entry));
  queues.set(address, next);
}

// Fails closed: any error, including a policy denial, is logged and recorded
// and the sweep stops. Nothing is retried and no other destination is tried.
async function runSweep(record: SweepRecord, entry: DepositAddressEntry) {
  const tag = `[sweep] ${record.eventId} ${record.asset} ${entry.address}`;
  try {
    const client = delegatedClient(entry.subOrgId);
    const treasury = serverEnv.treasury;

    const amount = await readBalance(client, entry, record.asset);
    if (amount <= BigInt(0)) {
      update(record, { status: "skipped", detail: "Nothing left to sweep." });
      console.log(`${tag} nothing to sweep`);
      return;
    }

    // The only two calls the delegated policy allows.
    const call =
      record.asset === "ETH"
        ? { to: treasury, value: amount.toString() }
        : {
            to: USDC_ADDRESS,
            value: "0",
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "transfer",
              args: [treasury, amount],
            }),
          };

    console.log(`${tag} sending ${amount} to ${treasury} (sponsored)`);
    const res = await client.ethSendTransaction({
      organizationId: entry.subOrgId,
      from: entry.address,
      caip2: BASE_SEPOLIA_CAIP2,
      sponsor: true,
      calls: [call],
    });

    const { status, id } = res.activity;
    if (
      status !== "ACTIVITY_STATUS_COMPLETED" ||
      !res.sendTransactionStatusId
    ) {
      throw new Error(`activity ${id} ended as ${status}`);
    }
    update(record, { status: "submitted", amount: amount.toString() });

    await waitForInclusion(client, entry, record, res.sendTransactionStatusId);
    console.log(`${tag} swept in ${record.txHash}`);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    update(record, { status: "failed", detail });
    console.error(`${tag} FAILED, not retrying: ${detail}`);
  }
}

// Reads the current on-account balance of the asset. The balance index can
// trail the webhook by a moment, so give it a few seconds to catch up.
async function readBalance(
  client: DelegatedClient,
  entry: DepositAddressEntry,
  asset: SweepAsset,
): Promise<bigint> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { balances = [] } = await client.getWalletAddressBalances({
      organizationId: entry.subOrgId,
      address: entry.address,
      caip2: BASE_SEPOLIA_CAIP2,
    });
    const match = balances.find(
      (b) => b.caip19 !== undefined && sweepAssetOf(b.caip19) === asset,
    );
    const amount = BigInt(match?.balance ?? "0");
    if (amount > BigInt(0)) return amount;
    await sleep(2000);
  }
  return BigInt(0);
}

async function waitForInclusion(
  client: DelegatedClient,
  entry: DepositAddressEntry,
  record: SweepRecord,
  sendTransactionStatusId: string,
) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const status = await client.getSendTransactionStatus({
      organizationId: entry.subOrgId,
      sendTransactionStatusId,
    });
    if (status.eth?.txHash && status.eth.txHash !== record.txHash) {
      update(record, { txHash: status.eth.txHash });
    }
    const txStatus = status.txStatus.replace(/^TX_STATUS_/, "");
    if (txStatus === "FAILED" || txStatus === "CANCELLED") {
      throw new Error(
        status.error?.message ?? status.txError ?? `transaction ${txStatus}`,
      );
    }
    if (txStatus === "INCLUDED" || txStatus === "COMPLETED") {
      update(record, { status: "swept" });
      return;
    }
    await sleep(1000);
  }
  update(record, { detail: "Still waiting for inclusion after 90s." });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
