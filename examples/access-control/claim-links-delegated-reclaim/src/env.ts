import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    API_PUBLIC_KEY: z.string().min(1),
    API_PRIVATE_KEY: z.string().min(1),
    TURNKEY_BASE_URL: z.string().url().default("https://api.turnkey.com"),
    SIGN_WITH: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  },
  client: {
    NEXT_PUBLIC_TURNKEY_ORG_ID: z.string().min(1),
    NEXT_PUBLIC_BASE_URL: z.string().url(),
    NEXT_PUBLIC_EVM_CHAIN: z.string().regex(/^eip155:\d+$/),
    NEXT_PUBLIC_USDC_CONTRACT: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID: z.string().min(1),
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
  },
  runtimeEnv: {
    API_PUBLIC_KEY: process.env.API_PUBLIC_KEY,
    API_PRIVATE_KEY: process.env.API_PRIVATE_KEY,
    TURNKEY_BASE_URL: process.env.TURNKEY_BASE_URL,
    SIGN_WITH: process.env.SIGN_WITH,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    NEXT_PUBLIC_TURNKEY_ORG_ID: process.env.NEXT_PUBLIC_TURNKEY_ORG_ID,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_EVM_CHAIN: process.env.NEXT_PUBLIC_EVM_CHAIN,
    NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID:
      process.env.NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_USDC_CONTRACT: process.env.NEXT_PUBLIC_USDC_CONTRACT,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.npm_lifecycle_event === "build" ||
    process.env.npm_lifecycle_event === "typecheck" ||
    process.env.npm_lifecycle_event === "dev",
  emptyStringAsUndefined: true,
});
