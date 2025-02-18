import React, { createContext, useEffect, useRef, useState } from "react";
import * as Keychain from "react-native-keychain";
import {
  generateP256KeyPair,
  getPublicKey,
  decryptCredentialBundle,
} from "@turnkey/crypto";
import { uint8ArrayToHexString } from "@turnkey/encoding";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { OTP_AUTH_DEFAULT_EXPIRATION_SECONDS } from "../constant";
import { Wallet } from "../types";

export type Session = {
  publicKey: string;
  privateKey: string;
  expiry: number;
};

export type User = {
  id: string;
  userName: string;
  email: string | undefined;
  phoneNumber: string | undefined;
  organizationId: string;
  wallets: Wallet[];
};

export interface SessionContextType {
  session: Session | null;
  client: TurnkeyClient | null;
  user: User | null;
  refreshUser: () => Promise<void>;
  createEmbeddedKey: () => Promise<string>;
  createSession: (bundle: string, expiry?: number) => Promise<Session>;
  clearSession: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextType | undefined>(
  undefined,
);

export interface SessionConfig {
  apiBaseUrl: string;
  onSessionCreated?: (session: Session) => void;
  onSessionExpired?: () => void;
  onSessionCleared?: () => void;
}

export const SessionProvider: React.FC<{
  children: React.ReactNode;
  config: SessionConfig;
}> = ({ children, config }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [client, setClient] = useState<TurnkeyClient | null>(null);

  const expiryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Effect hook that initializes the session state from secure storage.
   *
   * - Retrieves the stored session upon component mount.
   * - If a valid session is found (i.e., not expired), it updates the state, triggers `onSessionCreated`,
   *   and schedules automatic session expiration handling.
   * - If the session has expired, it calls `onSessionExpired`.
   *
   * This effect runs only once on mount and ensures that the session lifecycle is properly managed.
   */
  useEffect(() => {
    (async () => {
      const session = await getSession();

      if (session?.expiry && session.expiry > Date.now()) {
        setSession(session);
        config.onSessionCreated?.(session);
        scheduleSessionExpiration(session.expiry);
      } else {
        config.onSessionExpired?.();
      }
    })();
  }, []);

  /**
   * Effect hook that initializes the client when the session changes.
   *
   * - Calls `initializeClient` to configure the API client.
   *
   * Runs whenever `session` changes.
   */
  useEffect(() => {
    initializeClient();
  }, [session]);

  /**
   * Effect hook that fetches user data when the client is initialized.
   *
   * - Calls `fetchUser` to retrieve user data.
   *
   * Runs whenever `client` changes.
   */
  useEffect(() => {
    fetchUser();
  }, [client]);

  /**
   * Initializes the API client with the current session credentials.
   *
   * - Creates an `ApiKeyStamper` using the session keys.
   * - Instantiates a `TurnkeyClient` with the configured API base URL.
   * - Updates the client state.
   *
   * Does nothing if `session` is null.
   */
  const initializeClient = () => {
    if (session) {
      const stamper = new ApiKeyStamper({
        apiPrivateKey: session.privateKey,
        apiPublicKey: session.publicKey,
      });
      const client = new TurnkeyClient({ baseUrl: config.apiBaseUrl }, stamper);
      setClient(client);
    }
  };

  /**
   * Fetches and updates the user state.
   *
   * - Retrieves the user and organization ID.
   * - Fetches user details and wallets.
   * - Updates the user state.
   *
   * Does nothing if `session` or `client` is null.
   */
  const fetchUser = async () => {
    if (session && client) {
      const whoami = await client.getWhoami({
        organizationId: process.env.EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID ?? "",
      });

      if (whoami.userId && whoami.organizationId) {
        const [walletsResponse, userResponse] = await Promise.all([
          client.getWallets({ organizationId: whoami.organizationId }),
          client.getUser({
            organizationId: whoami.organizationId,
            userId: whoami.userId,
          }),
        ]);

        const wallets = await Promise.all(
          walletsResponse.wallets.map(async (wallet) => {
            const accounts = await client.getWalletAccounts({
              organizationId: whoami.organizationId,
              walletId: wallet.walletId,
            });
            return {
              name: wallet.walletName,
              id: wallet.walletId,
              accounts: accounts.accounts.map((account) => {
                return {
                  id: account.walletAccountId,
                  curve: account.curve,
                  pathFormat: account.pathFormat,
                  path: account.path,
                  addressFormat: account.addressFormat,
                  address: account.address,
                  createdAt: account.createdAt,
                  updatedAt: account.updatedAt,
                };
              }),
            };
          }),
        );

        const user = userResponse.user;

        setUser({
          id: user.userId,
          userName: user.userName,
          email: user.userEmail,
          phoneNumber: user.userPhoneNumber,
          organizationId: whoami.organizationId,
          wallets,
        });
      }
    }
  };

  /**
   * Refreshes the user state.
   *
   * - Calls `fetchUser` to update user data.
   * - Should be run when user data changes.
   */
  const refreshUser = async () => {
    await fetchUser();
  };

  /**
   * Clears any scheduled expiration timeouts
   */
  const clearTimeouts = () => {
    if (expiryTimeoutRef.current) clearTimeout(expiryTimeoutRef.current);
  };

  /**
   * Schedules session expiration callback
   * @param expiryTime - The Unix timestamp of session expiration
   */
  const scheduleSessionExpiration = (expiryTime: number) => {
    clearTimeouts();
    const timeUntilExpiry = expiryTime - Date.now();

    if (timeUntilExpiry > 0) {
      expiryTimeoutRef.current = setTimeout(() => {
        clearSession();
        config.onSessionExpired?.();
      }, timeUntilExpiry);
    } else {
      clearSession();
      config.onSessionExpired?.();
    }
  };

  /**
   * Retrieves the stored embedded key from secure storage.
   * Optionally deletes the key from storage after retrieval.
   *
   * @param deleteKey Whether to remove the embedded key after retrieval. Defaults to `true`.
   * @returns The embedded private key if found, otherwise `null`.
   * @throws If retrieving or deleting the key fails.
   */
  const getEmbeddedKey = async (deleteKey = true) => {
    const credentials = await Keychain.getGenericPassword({
      service: "turnkey-embedded-key",
    });
    if (credentials) {
      if (deleteKey) {
        await Keychain.resetGenericPassword({
          service: "turnkey-embedded-key",
        });
      }
      return credentials.password;
    }
    return null;
  };

  /**
   * Saves an embedded key securely in storage.
   *
   * @param key The private key to store securely.
   * @throws If saving the key fails.
   */
  const saveEmbeddedKey = async (key: string) => {
    try {
      await Keychain.setGenericPassword("turnkey-embedded-key", key, {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: "turnkey-embedded-key",
      });
    } catch (error) {
      throw new Error("Could not save the embedded key.");
    }
  };

  /**
   * Generates a new embedded key pair and securely stores the private key in secure storage.
   *
   * @returns The public key corresponding to the generated embedded key pair.
   * @throws If saving the private key fails.
   */
  const createEmbeddedKey = async () => {
    const key = generateP256KeyPair();
    const embeddedPrivateKey = key.privateKey;
    const publicKey = key.publicKeyUncompressed;

    await saveEmbeddedKey(embeddedPrivateKey);

    return publicKey;
  };

  /**
   * Retrieves the stored session from secure storage.
   *
   * @returns The stored session or `null` if not found.
   * @throws If retrieving the session fails.
   */
  const getSession = async (): Promise<Session | null> => {
    const credentials = await Keychain.getGenericPassword({
      service: "turnkey-session",
    });

    if (credentials) {
      return JSON.parse(credentials.password);
    }
    return null;
  };

  /**
   * Saves a session securely in secure storage.
   *
   * @param session The session object to store.
   * @throws If saving the session fails.
   */
  const saveSession = async (session: Session) => {
    try {
      setSession(session);
      await Keychain.setGenericPassword(
        "turnkey-session",
        JSON.stringify(session),
        {
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          service: "turnkey-session",
        },
      );
      scheduleSessionExpiration(session.expiry);
    } catch (error) {
      throw new Error("Could not save the session.");
    }
  };

  /**
   * Creates a session from a given credential bundle.
   * The session consists of a private key, its corresponding public key, and an expiration timestamp.
   * The session is securely stored in secure storage for future retrieval.
   *
   *
   * @param bundle The credential bundle containing encrypted session data.
   * @param expirySeconds The session expiration time in seconds. Defaults to `15 minutes`.
   * @returns A `Session` object containing public and private keys with an expiration timestamp.
   * @throws If the embedded key is missing or if decryption fails.
   */
  const createSession = async (
    bundle: string,
    expirySeconds: number = OTP_AUTH_DEFAULT_EXPIRATION_SECONDS,
  ): Promise<Session> => {
    const embeddedKey = await getEmbeddedKey();
    if (!embeddedKey) {
      throw new Error("Embedded key not found.");
    }

    const privateKey = decryptCredentialBundle(bundle, embeddedKey);

    const expiry = Date.now() + expirySeconds * 1000;

    const publicKey = uint8ArrayToHexString(getPublicKey(privateKey));
    const session = { publicKey, privateKey, expiry };
    await saveSession(session);

    config.onSessionCreated?.(session);
    return session;
  };

  /**
   * Clears the current session by removing all stored credentials and session data.
   *
   * - Sets `session`, `client`, and `user` to `null`.
   * - Removes stored session from secure storage.
   * - Calls `onSessionCleared` if provided.
   *
   * @throws If the session cannot be cleared from secure storage.
   */
  const clearSession = async () => {
    try {
      setSession(null);
      setClient(null);
      setUser(null);
      await Keychain.resetGenericPassword({ service: "turnkey-session" });

      config.onSessionCleared?.();
    } catch (error) {
      throw new Error("Could not clear the session.");
    }
  };

  return (
    <SessionContext.Provider
      value={{
        session,
        client,
        user,
        refreshUser,
        createEmbeddedKey,
        createSession,
        clearSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};
