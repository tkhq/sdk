"use server";

import { BreezeSDK } from "@breezebaby/breeze-sdk";

const breeze = new BreezeSDK({
  apiKey: process.env.BREEZE_API_KEY!,
  baseUrl: "https://api.breeze.baby",
  timeout: 30000,
});

export async function createDepositTx({
  payerKey,
  userKey,
  fundId,
  amount,
  mint,
}: {
  payerKey: string;
  userKey: string;
  fundId: string;
  amount: number;
  mint: string;
}) {
  return breeze.createDepositTransaction({
    payerKey,
    userKey,
    fundId,
    amount,
    mint,
  });
}

export async function createWithdrawTx({
  payerKey,
  userKey,
  fundId,
  amount,
}: {
  payerKey: string;
  userKey: string;
  fundId: string;
  amount: number;
}) {
  return breeze.createWithdrawTransaction({
    payerKey,
    userKey,
    fundId,
    amount,
  });
}

export async function getUserData(userId: string) {
  const [balances, yieldInfo] = await Promise.all([
    breeze.getUserBalances({ userId }),
    breeze.getUserYield({ userId }),
  ]);
  console.log("balances", balances);
  console.log("yieldInfo", yieldInfo);
  return { balances: balances.data || [], yieldInfo: yieldInfo.data || [] };
}
