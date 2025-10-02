// re-export from core
export {
  TurnkeyClient,
  type TurnkeyClientMethods,
  type TurnkeySDKClientBase,
  isEthereumProvider,
  isSolanaProvider,
} from "@turnkey/core";

// package exports
export { useModal } from "./modal/Hook";
export { useTurnkey } from "./client/Hook";
export * from "./TurnkeyProvider";
export type { ClientContextType } from "./client/Types";
