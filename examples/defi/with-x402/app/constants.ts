// USDC address on Base Sepolia
export const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// 0.01 USDC (6 decimals)
export const PAYMENT_AMOUNT = "10000";

// Cookie timeout
export const COOKIE_TIMEOUT_SECONDS = 300;

// Payment requirements
export const PAYMENT_REQUIREMENTS = {
  scheme: "exact" as const,
  network: "base-sepolia" as const,
  maxAmountRequired: PAYMENT_AMOUNT, // 0.01 USDC
  resource: "http://example.com/",
  description: "Access to protected content",
  mimeType: "text/html",
  payTo: process.env.NEXT_PUBLIC_RESOURCE_WALLET_ADDRESS!,
  maxTimeoutSeconds: COOKIE_TIMEOUT_SECONDS,
  asset: USDC_ADDRESS, // USDC on Base Sepolia
  extra: { name: "USDC", version: "2" },
};
