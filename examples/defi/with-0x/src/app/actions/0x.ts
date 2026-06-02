"use server";

export interface PriceParams {
  chainId: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  taker: string;
}

export async function getPrice(priceParams: PriceParams) {
  const params = new URLSearchParams({
    chainId: priceParams.chainId,
    sellToken: priceParams.sellToken,
    buyToken: priceParams.buyToken,
    sellAmount: priceParams.sellAmount,
    taker: priceParams.taker,
  });

  const headers = {
    "0x-api-key": process.env.ZEROX_API_KEY!, // Get your live API key from the 0x Dashboard (https://dashboard.0x.org/apps)
    "0x-version": "v2",
  };

  const priceResponse = await fetch(
    "https://api.0x.org/swap/allowance-holder/price?" + params.toString(),
    {
      headers,
    },
  );

  const response = await priceResponse.json();

  return response;
}

export async function getQuote(quoteParams: PriceParams) {
  const params = new URLSearchParams({
    chainId: quoteParams.chainId,
    sellToken: quoteParams.sellToken,
    buyToken: quoteParams.buyToken,
    sellAmount: quoteParams.sellAmount,
    taker: quoteParams.taker,
  });

  const headers = {
    "0x-api-key": process.env.ZEROX_API_KEY!, // Get your live API key from the 0x Dashboard (https://dashboard.0x.org/apps)
    "0x-version": "v2",
  };

  const quoteResponse = await fetch(
    "https://api.0x.org/swap/allowance-holder/quote?" + params.toString(),
    {
      headers,
    },
  );

  const response = await quoteResponse.json();

  return response;
}

export async function getChains() {
  const headers = {
    "0x-api-key": process.env.ZEROX_API_KEY!, // Get your live API key from the 0x Dashboard (https://dashboard.0x.org/apps)
    "0x-version": "v2",
  };

  const chainsResponse = await fetch("https://api.0x.org/swap/chains", {
    headers,
  });

  const response = await chainsResponse.json();

  return response;
}
