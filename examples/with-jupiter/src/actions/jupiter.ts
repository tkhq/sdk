"use server";

const ULTRA_ORDER_URL =
  process.env.JUP_ULTRA_ORDER_URL || "https://lite-api.jup.ag/ultra/v1/order";
const ULTRA_EXECUTE_URL =
  process.env.JUP_ULTRA_EXECUTE_URL || "https://lite-api.jup.ag/ultra/v1/execute";

interface OrderParams {
  inputMint: string;
  outputMint: string;
  amount: number; 
  taker: string;  
  slippageBps?: number;
}

interface ExecuteParams {
  requestId: string;
  signedTransaction: string; // base64 signed tx
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

  const resp = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

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
