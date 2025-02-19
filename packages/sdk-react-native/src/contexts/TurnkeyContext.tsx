import {
  type ReactNode,
  type FC,
  createContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as Keychain from "react-native-keychain";
import {
  generateP256KeyPair,
  getPublicKey,
  decryptCredentialBundle,
} from "@turnkey/crypto";
import { uint8ArrayToHexString } from "@turnkey/encoding";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  TURNKEY_EMBEDDED_KEY_STORAGE,
  TURNKEY_SESSION_STORAGE,
  OTP_AUTH_DEFAULT_EXPIRATION_SECONDS,
} from "../constant";
import type { Session, User } from "../types";
import { TurnkeyReactNativeError } from "../errors";

export interface TurnkeyContextType {
  session: Session | undefined;
  client: TurnkeyClient | undefined;
  user: User | undefined;
  refreshUser: () => Promise<void>;
  createEmbeddedKey: () => Promise<string>;
  createSession: (bundle: string, expiry?: number) => Promise<Session>;
  clearSession: () => Promise<void>;
}

export const TurnkeyContext = createContext<TurnkeyContextType | undefined>(
  undefined,
);

export interface TurnkeyConfig {
  apiBaseUrl: string;
  organizationId: string;
  onSessionCreated?: (session: Session) => void;
  onSessionExpired?: () => void;
  onSessionCleared?: () => void;
}

export const TurnkeyProvider: FC<{
  children: ReactNode;
  config: TurnkeyConfig;
}> = ({ children, config }) => {
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [client, setClient] = useState<TurnkeyClient | undefined>(undefined);

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

        const client = createClient(session.publicKey, session.privateKey);
        setClient(client);

        config.onSessionCreated?.(session);
        scheduleSessionExpiration(session.expiry);
      } else {
        await clearSession();
        config.onSessionExpired?.();
      }
    })();

    return () => {
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Creates an API client instance using the provided session credentials.
   *
   * - Creates an `ApiKeyStamper` using the provided keys.
   * - Instantiates a `TurnkeyClient` with the configured API base URL.
   *
   * @param publicKey - The public key.
   * @param privateKey - The private key.
   * @returns A new TurnkeyClient instance.
   */
  const createClient = (
    publicKey: string,
    privateKey: string,
  ): TurnkeyClient => {
    const stamper = new ApiKeyStamper({
      apiPrivateKey: privateKey,
      apiPublicKey: publicKey,
    });
    return new TurnkeyClient({ baseUrl: config.apiBaseUrl }, stamper);
  };

  /**
   * Fetches the user data including organization details and wallets.
   *
   * @param client - A TurnkeyClient instance to make API calls.
   * @returns The fetched user data, or undefined if not found.
   */
  const fetchUser = async (
    client: TurnkeyClient,
  ): Promise<User | undefined> => {
    const whoami = await client.getWhoami({
      organizationId: config.organizationId,
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

      return {
        id: user.userId,
        userName: user.userName,
        email: user.userEmail,
        phoneNumber: user.userPhoneNumber,
        organizationId: whoami.organizationId,
        wallets,
      };
    }
    return undefined;
  };

  /**
   * Refreshes the user state.
   *
   * - Calls `fetchUser` to update user data.
   * - Should be run when user data changes.
   */
  const refreshUser = async () => {
    if (session && client) {
      const updatedUser = await fetchUser(client);

      if (updatedUser) {
        const updatedSession: Session = { ...session, user: updatedUser };
        await updateSession(updatedSession);
      }
    }
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
      service: TURNKEY_EMBEDDED_KEY_STORAGE,
    });
    if (credentials) {
      if (deleteKey) {
        await Keychain.resetGenericPassword({
          service: TURNKEY_EMBEDDED_KEY_STORAGE,
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
      await Keychain.setGenericPassword(TURNKEY_EMBEDDED_KEY_STORAGE, key, {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: TURNKEY_EMBEDDED_KEY_STORAGE,
      });
    } catch (error) {
      throw new TurnkeyReactNativeError(
        "Could not save the embedded key.",
        error,
      );
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
      service: TURNKEY_SESSION_STORAGE,
    });

    if (credentials) {
      return JSON.parse(credentials.password);
    }
    return null;
  };

  /**
   * Saves a session securely in secure storage.
   *
   * - Persists the session to secure storage.
   * - Updates the in-memory session state.
   * - Schedules the session expiration as a side effect.
   *
   * @param session The session object to store.
   * @throws If saving the session fails.
   */
  const saveSession = async (session: Session) => {
    try {
      await Keychain.setGenericPassword(
        TURNKEY_SESSION_STORAGE,
        JSON.stringify(session),
        {
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          service: TURNKEY_SESSION_STORAGE,
        },
      );
      setSession(session);

      scheduleSessionExpiration(session.expiry);
    } catch (error) {
      throw new TurnkeyReactNativeError("Could not save the session", error);
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
      throw new TurnkeyReactNativeError("Embedded key not found.");
    }

    const privateKey = decryptCredentialBundle(bundle, embeddedKey);
    const publicKey = uint8ArrayToHexString(getPublicKey(privateKey));
    const expiry = Date.now() + expirySeconds * 1000;

    const client = createClient(publicKey, privateKey);
    setClient(client);

    const user = await fetchUser(client);

    if (!user) {
      throw new TurnkeyReactNativeError("User not found.");
    }

    const session = { publicKey, privateKey, expiry, user };
    await saveSession(session);

    config.onSessionCreated?.(session);
    return session;
  };

  /**
   * Updates the current session both in memory and in secure storage.
   *
   * - Persists the updated session to secure storage.
   * - Updates the in-memory session state.
   * - Reschedules the session expiration as a side effect.
   *
   * @param updatedSession The new session object.
   * @throws If updating the session fails.
   */
  const updateSession = async (updatedSession: Session) => {
    try {
      await Keychain.setGenericPassword(
        TURNKEY_SESSION_STORAGE,
        JSON.stringify(updatedSession),
        {
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          service: TURNKEY_SESSION_STORAGE,
        },
      );
      setSession(updatedSession);

      scheduleSessionExpiration(updatedSession.expiry);
    } catch (error) {
      throw new TurnkeyReactNativeError("Could not update the session.", error);
    }
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
      setSession(undefined);
      setClient(undefined);
      await Keychain.resetGenericPassword({ service: TURNKEY_SESSION_STORAGE });

      config.onSessionCleared?.();
    } catch (error) {
      throw new TurnkeyReactNativeError("Could not clear the session.");
    }
  };

  return (
    <TurnkeyContext.Provider
      value={{
        session,
        client,
        user: session?.user,
        refreshUser,
        createEmbeddedKey,
        createSession,
        clearSession,
      }}
    >
      {children}
    </TurnkeyContext.Provider>
  );
};
