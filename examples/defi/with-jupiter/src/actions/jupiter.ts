"use server";

const ULTRA_ORDER_URL =
  process.env.JUP_ULTRA_ORDER_URL || "https://lite-api.jup.ag/ultra/v1/order";
const ULTRA_EXECUTE_URL =
  process.env.JUP_ULTRA_EXECUTE_URL ||
  "https://lite-api.jup.ag/ultra/v1/execute";
const ULTRA_BALANCES_URL =
  process.env.JUP_ULTRA_BALANCES_URL ||
  "https://lite-api.jup.ag/ultra/v1/balances";
const JUP_QUOTE_URL =
  process.env.JUP_QUOTE_URL || "https://lite-api.jup.ag/swap/v1/quote";

interface OrderParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  taker: string;
  slippageBps?: number;
}

interface ExecuteParams {
  requestId: string;
  signedTransaction: string;
}

interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
}

/**
 * Create Ultra order (unsigned tx + requestId)
 */
export async function createUltraOrder(params: OrderParams) {
  const { inputMint, outputMint, amount, taker, slippageBps = 50 } = params;

  const url =
    `${ULTRA_ORDER_URL}?` +
    `inputMint=${encodeURIComponent(inputMint)}` +
    `&outputMint=${encodeURIComponent(outputMint)}` +
    `&amount=${amount}` +
    `&taker=${encodeURIComponent(taker)}` +
    `&slippageBps=${slippageBps}`;

  const resp = await fetch(url, { method: "GET", cache: "no-store" });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Ultra order failed: ${resp.status} ${err}`);
  }

  return resp.json();
}

/**
 * Execute Ultra order (broadcast signed tx)
 */
export async function executeUltraOrder(params: ExecuteParams) {
  const resp = await fetch(ULTRA_EXECUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Ultra execute failed: ${resp.status} ${err}`);
  }

  return resp.json();
}

/**
 * Get Ultra balances for a wallet address
 */
export async function getUltraBalances(taker: string) {
  const url = `${ULTRA_BALANCES_URL}/${encodeURIComponent(taker)}`;
  const resp = await fetch(url, { method: "GET", cache: "no-store" });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Ultra balances failed: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return data;
}

/**
 * Get quote from Jupiter Swap Quote API
 */
export async function getUltraQuote(params: QuoteParams) {
  const { inputMint, outputMint, amount, slippageBps = 50 } = params;

  const url =
    `${JUP_QUOTE_URL}?` +
    `inputMint=${encodeURIComponent(inputMint)}` +
    `&outputMint=${encodeURIComponent(outputMint)}` +
    `&amount=${amount}` +
    `&slippageBps=${slippageBps}`;

  const resp = await fetch(url, { method: "GET", cache: "no-store" });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Ultra quote failed: ${resp.status} ${err}`);
  }

  return resp.json();
}
