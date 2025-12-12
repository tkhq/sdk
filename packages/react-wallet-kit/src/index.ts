/** @internal */
import "./index.css";
export * from "./providers";
export * from "./types/base";
export * from "./types/method-types";

// Re-export selected values from @turnkey/core
export {
  TurnkeyClient,
  type TurnkeyClientMethods,
  type TurnkeySDKClientBase,
  isEthereumProvider,
  isSolanaProvider,
  sendSignedRequest,
  decodeVerificationToken,
  getClientSignatureMessageForLogin,
  getClientSignatureMessageForSignup,
} from "@turnkey/core";

// Re-export all types from @turnkey/core
//
// Why this is complicated:
//
// 1. we reference `dist/` because `src/` is not published to npm. Importing from `src/`
//    works locally with pnpm workspace links, but breaks for npm consumers since only
//    `dist/` exists in the published package
//
// 2. files containing only types/interfaces produce no `.js` output when compiled (TypeScript
//    erases them). Using `export *` on these files causes an error because there's no
//    JavaScript to import. We use `export type *` instead. Enums are the exception - they
//    generate runtime JavaScript, so we use `export *`
//
// 3. we import each file individually instead of using `__types__/index.ts` because
//    `export type *` doesn't re-export types that are themselves re-exported from other
//    modules - it only exports types defined directly in that file. We still use
//    `__types__/index.ts` internally within core as a convenience import
/** @internal */
export type * from "@turnkey/core/dist/__types__/auth";
/** @internal */
export type * from "@turnkey/core/dist/__types__/config";
/** @internal */
export * from "@turnkey/core/dist/__types__/enums";
/** @internal */
export type * from "@turnkey/core/dist/__types__/error";
/** @internal */
export type * from "@turnkey/core/dist/__types__/export";
/** @internal */
export type * from "@turnkey/core/dist/__types__/external-wallets";
/** @internal */
export type * from "@turnkey/core/dist/__types__/http";
/** @internal */
export type * from "@turnkey/core/dist/__types__/method-types/import-export-params";
/** @internal */
export type * from "@turnkey/core/dist/__types__/method-types/shared";
