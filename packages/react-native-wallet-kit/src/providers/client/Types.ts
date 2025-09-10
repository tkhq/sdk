import type {
  TurnkeySDKClientBase,
  TurnkeyClientMethods,
  Wallet,
  StamperType,
} from "@turnkey/core";
import type {
  Session,
  v1User,
} from "@turnkey/sdk-types";
import type {
  TurnkeyProviderConfig,
  AuthState,
  ClientState,
} from "../../types/base";
import { createContext } from "react";

export interface ClientContextType extends TurnkeyClientMethods {
  /** @internal */
  httpClient: TurnkeySDKClientBase | undefined;
  /** @internal */
  session: Session | undefined;
  /** @internal */
  allSessions?: Record<string, Session> | undefined;
  /** @internal */
  clientState: ClientState | undefined;
  /** @internal */
  authState: AuthState;
  /** @internal */
  config?: TurnkeyProviderConfig | undefined;
  /** @internal */
  user: v1User | undefined;
  /** @internal */
  wallets: Wallet[];

  /**
   * Refreshes the user details.
   */
  refreshUser: (params?: {
    stampWith?: StamperType | undefined;
  }) => Promise<void>;

  /**
   * Refreshes the wallets state for the current user session.
   */
  refreshWallets: (params?: {
    stampWith?: StamperType | undefined;
  }) => Promise<void>;

  /**
   * Handles the login or sign-up flow.
   */
  handleLogin: () => Promise<void>;

  // TODO: Add all the other handle methods as we implement them
  // This is a skeleton implementation for now
}

/** @internal */
export const ClientContext = createContext<ClientContextType | undefined>(
  undefined,
);