// ENTRY FILE FOR TYPEDOC - all exports here will be included in the generated docs

export * from "../__types__/index";
export { TurnkeyClient, type TurnkeyClientMethods } from "../__clients__/core";
export {
  buildWalletLoginMessage,
  normalizeSiwxDomain,
  normalizeWalletSignature,
  type WalletLoginChain,
  type BuildWalletLoginMessageParams,
} from "../__wallet__/wallet-login-message";
