"use server";

export interface QuoteParams {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
}

export interface StatusParams {
  txHash: string;
}

export async function getQuote(quoteParams: QuoteParams) {
  const params = new URLSearchParams({
    fromChain: quoteParams.fromChain,
    toChain: quoteParams.toChain,
    fromToken: quoteParams.fromToken,
    toToken: quoteParams.toToken,
    fromAmount: quoteParams.fromAmount,
    fromAddress: quoteParams.fromAddress,
    toAddress: quoteParams.toAddress,
  });

  const quoteResponse = await fetch(
    "https://li.quest/v1/quote?" + params.toString(),
    process.env.LIFI_API_KEY
      ? { headers: { "x-lifi-api-key": process.env.LIFI_API_KEY } }
      : {}, // Get your live API key from the Li.Fi Partner Portal https://portal.li.fi/login
  );

  const response = await quoteResponse.json();

  return response;
}

export async function getStatus(statusParams: StatusParams) {
  const params = new URLSearchParams({
    txHash: statusParams.txHash,
  });

  const statusResponse = await fetch(
    "https://li.quest/v1/status?" + params.toString(),
    process.env.LIFI_API_KEY
      ? { headers: { "x-lifi-api-key": process.env.LIFI_API_KEY } }
      : {}, // Get your live API key from the Li.Fi Partner Portal https://portal.li.fi/login
  );

  const response = await statusResponse.json();

  return response;
}
