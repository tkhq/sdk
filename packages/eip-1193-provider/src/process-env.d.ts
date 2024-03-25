import { UUID } from "crypto";

export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      WALLET_ID: UUID;
      ORG_ID: UUID;
      TURNKEY_API_PUBLIC_KEY: string;
      TURNKEY_API_PRIVATE_KEY: string;
    }
  }
}
