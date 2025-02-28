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
  encryptWalletToBundle,
  decryptExportBundle,
} from "@turnkey/crypto";
import { uint8ArrayToHexString } from "@turnkey/encoding";
import { TurnkeyClient } from "@turnkey/http";
import {
  TURNKEY_EMBEDDED_KEY_STORAGE,
  TURNKEY_SESSION_STORAGE,
  OTP_AUTH_DEFAULT_EXPIRATION_SECONDS,
  TURNKEY_ACTIVE_SESSION,
} from "../constant";
import type {
  Activity,
  HashFunction,
  PayloadEncoding,
  Session,
  SignRawPayloadResult,
  User,
  WalletAccountParams,
} from "../types";
import { TurnkeyReactNativeError } from "../errors";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

export interface TurnkeyContextType {
  session: Session | undefined;
  client: TurnkeyClient | undefined;
  user: User | undefined;
  setActiveSession: (storageKey: string) => Promise<Session | undefined>;
  updateUser: (userDetails: {
    email?: string;
    phone?: string;
  }) => Promise<Activity>;
  refreshUser: () => Promise<void>;
  createEmbeddedKey: () => Promise<string>;
  createSession: (bundle: string, expiry?: number) => Promise<Session>;
  clearSession: () => Promise<void>;
  createWallet: (params: {
    walletName: string;
    accounts: WalletAccountParams[];
    mnemonicLength?: number;
  }) => Promise<Activity>;
  importWallet: (params: {
    walletName: string;
    mnemonic: string;
    accounts: WalletAccountParams[];
  }) => Promise<Activity>;
  exportWallet: (params: { walletId: string }) => Promise<string>;
  signRawPayload: (params: {
    signWith: string;
    payload: string;
    encoding: PayloadEncoding;
    hashFunction: HashFunction;
  }) => Promise<SignRawPayloadResult>;
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
      const storageKey = await getActiveStorageKey();
      if (!storageKey) {
        return;
      }

      const session = await getSession(storageKey);

      if (session?.expiry && session.expiry > Date.now()) {
        setSession(session);

        const client = createClient(
          session.publicKey,
          session.privateKey,
          config.apiBaseUrl,
        );
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

  const setActiveSession = async (storageKey: string) => {
    const session = await getSession(storageKey);

    if (session?.expiry && session.expiry > Date.now()) {
      setSession(session);

      const client = createClient(
        session.publicKey,
        session.privateKey,
        config.apiBaseUrl,
      );
      setClient(client);

      saveActiveSession(storageKey);

      config.onSessionCreated?.(session);
      scheduleSessionExpiration(session.expiry);

      return session;
    } else {
      await clearSession(storageKey);
      config.onSessionExpired?.();

      return undefined;
    }
  };

  const getActiveStorageKey = async () => {
    const credentials = await Keychain.getGenericPassword({
      service: TURNKEY_ACTIVE_SESSION,
    });
    if (credentials) {
      return credentials.password;
    }
    return null;
  };

  const saveActiveSession = async (storageKey: string) => {
    try {
      await Keychain.setGenericPassword(TURNKEY_ACTIVE_SESSION, storageKey, {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: TURNKEY_ACTIVE_SESSION,
      });
    } catch (error) {
      throw new TurnkeyReactNativeError(
        "Could not save the embedded key.",
        error,
      );
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
    apiBaseUrl: string,
  ): TurnkeyClient => {
    const stamper = new ApiKeyStamper({
      apiPrivateKey: privateKey,
      apiPublicKey: publicKey,
    });
    return new TurnkeyClient({ baseUrl: apiBaseUrl }, stamper);
  };

  /**
   * Fetches the user data including organization details and wallets.
   *
   * @param client - A TurnkeyClient instance to make API calls.
   * @returns The fetched user data, or undefined if not found.
   */
  const fetchUser = async (
    client: TurnkeyClient,
    organizationId: string,
  ): Promise<User | undefined> => {
    const whoami = await client.getWhoami({
      organizationId: organizationId,
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
   * Retrieves the stored session from secure storage.
   *
   * @returns The stored session or `null` if not found.
   * @throws If retrieving the session fails.
   */
  const getSession = async (storageKey: string): Promise<Session | null> => {
    const credentials = await Keychain.getGenericPassword({
      service: storageKey,
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
  const saveSession = async (session: Session, storageKey: string) => {
    try {
      await Keychain.setGenericPassword(storageKey, JSON.stringify(session), {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: storageKey,
      });

      scheduleSessionExpiration(session.expiry);
    } catch (error) {
      throw new TurnkeyReactNativeError("Could not save the session", error);
    }
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

      scheduleSessionExpiration(updatedSession.expiry);
    } catch (error) {
      throw new TurnkeyReactNativeError("Could not update the session.", error);
    }
  };

  /**
   *
   * Updates the user's email and/or phone number.
   *
   * @param userDetails - Object containing the new email and/or phone number.
   * @returns The activity response from the user update.
   * @throws If the client or user is not initialized.
   */
  const updateUser = async (userDetails: {
    email?: string;
    phone?: string;
  }) => {
    if (client == null || session?.user == null) {
      throw new TurnkeyReactNativeError("Client or user not initialized");
    }
    const parameters: {
      userId: string;
      userTagIds: string[];
      userPhoneNumber?: string;
      userEmail?: string;
    } = {
      userId: session.user.id,
      userTagIds: [],
    };

    if (userDetails.phone && userDetails.phone.trim()) {
      parameters.userPhoneNumber = userDetails.phone;
    }

    if (userDetails.email && userDetails.email.trim()) {
      parameters.userEmail = userDetails.email;
    }

    const result = await client.updateUser({
      type: "ACTIVITY_TYPE_UPDATE_USER",
      timestampMs: Date.now().toString(),
      organizationId: session.user.organizationId,
      parameters,
    });

    const activity = result.activity;
    if (activity.result.updateUserResult?.userId) {
      await refreshUser();
    }

    return activity;
  };

  /**
   * Refreshes the user state.
   *
   * - Calls `fetchUser` to update user data.
   * - Should be run when user data changes.
   */
  const refreshUser = async () => {
    if (session && client) {
      const updatedUser = await fetchUser(client, config.organizationId);

      if (updatedUser) {
        const updatedSession: Session = { ...session, user: updatedUser };
        await updateSession(updatedSession);
        setSession(updatedSession);
      }
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
    storageKey: string = TURNKEY_SESSION_STORAGE,
  ): Promise<Session> => {
    const embeddedKey = await getEmbeddedKey();
    if (!embeddedKey) {
      throw new TurnkeyReactNativeError("Embedded key not found.");
    }

    const privateKey = decryptCredentialBundle(bundle, embeddedKey);
    const publicKey = uint8ArrayToHexString(getPublicKey(privateKey));
    const expiry = Date.now() + expirySeconds * 1000;

    const client = createClient(publicKey, privateKey, config.apiBaseUrl);
    setClient(client);

    const user = await fetchUser(client, config.organizationId);

    if (!user) {
      throw new TurnkeyReactNativeError("User not found.");
    }

    const session = { storageKey, publicKey, privateKey, expiry, user };
    await saveSession(session, storageKey);
    setSession(session);

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
  const clearSession = async (storageKey: string = TURNKEY_SESSION_STORAGE) => {
    try {
      setSession(undefined);
      setClient(undefined);
      await Keychain.resetGenericPassword({ service: storageKey });

      config.onSessionCleared?.();
    } catch (error) {
      throw new TurnkeyReactNativeError("Could not clear the session.");
    }
  };

  /**
   *
   * Creates a new wallet with the specified name and accounts.
   *
   * @param walletName - The name of the wallet.
   * @param accounts - The list of accounts associated with the wallet.
   * @param mnemonicLength - (Optional) The length of the mnemonic phrase (defaults to 12).
   * @returns The activity response from the wallet creation.
   * @throws If the client or user is not initialized.
   */

  const createWallet = async ({
    walletName,
    accounts,
    mnemonicLength,
  }: {
    walletName: string;
    accounts: WalletAccountParams[];
    mnemonicLength?: number;
  }): Promise<Activity> => {
    if (client == null || session?.user == null) {
      throw new TurnkeyReactNativeError("Client or user not initialized");
    }

    const parameters: {
      walletName: string;
      accounts: WalletAccountParams[];
      mnemonicLength?: number;
    } = { walletName, accounts };
    if (mnemonicLength != null) {
      parameters.mnemonicLength = mnemonicLength;
    }

    const response = await client.createWallet({
      type: "ACTIVITY_TYPE_CREATE_WALLET",
      timestampMs: Date.now().toString(),
      organizationId: session.user.organizationId,
      parameters: {
        walletName,
        accounts,
        ...(mnemonicLength != null && { mnemonicLength }),
      },
    });

    const activity = response.activity;
    if (activity.result.createWalletResult?.walletId) {
      await refreshUser();
    }

    return activity;
  };

  /**
   *
   * Imports a wallet using a provided mnemonic and creates accounts.
   *
   * @param walletName - The name of the wallet.
   * @param mnemonic - The mnemonic phrase used to restore the wallet.
   * @param accounts - The list of accounts associated with the wallet.
   * @returns The activity response from the wallet import.
   * @throws If the client or user is not initialized.
   */
  const importWallet = async ({
    walletName,
    mnemonic,
    accounts,
  }: {
    walletName: string;
    mnemonic: string;
    accounts: WalletAccountParams[];
  }): Promise<Activity> => {
    if (client == null || session?.user == null) {
      throw new TurnkeyReactNativeError("Client or user not initialized");
    }

    const initResponse = await client.initImportWallet({
      type: "ACTIVITY_TYPE_INIT_IMPORT_WALLET",
      timestampMs: Date.now().toString(),
      organizationId: session.user.organizationId,
      parameters: { userId: session.user.id },
    });

    const importBundle =
      initResponse.activity.result.initImportWalletResult?.importBundle;

    if (importBundle == null) {
      throw new TurnkeyReactNativeError("Failed to get import bundle");
    }

    const encryptedBundle = await encryptWalletToBundle({
      mnemonic,
      importBundle,
      userId: session.user.id,
      organizationId: session.user.organizationId,
    });

    const response = await client.importWallet({
      type: "ACTIVITY_TYPE_IMPORT_WALLET",
      timestampMs: Date.now().toString(),
      organizationId: session.user.organizationId,
      parameters: {
        userId: session.user.id,
        walletName,
        encryptedBundle,
        accounts,
      },
    });

    const activity = response.activity;
    if (activity.result.importWalletResult?.walletId) {
      await refreshUser();
    }

    return activity;
  };

  /**
   *
   * Exports an existing wallet by decrypting the stored mnemonic phrase.
   *
   * @param walletId - The unique identifier of the wallet to be exported.
   * @returns The decrypted mnemonic phrase of the wallet.
   * @throws If the client, user, or export bundle is not initialized.
   */
  const exportWallet = async ({
    walletId,
  }: {
    walletId: string;
  }): Promise<string> => {
    const { publicKeyUncompressed: targetPublicKey, privateKey: embeddedKey } =
      generateP256KeyPair();

    if (client == null || session?.user == null) {
      throw new TurnkeyReactNativeError("Client or user not initialized");
    }

    const response = await client.exportWallet({
      type: "ACTIVITY_TYPE_EXPORT_WALLET",
      timestampMs: Date.now().toString(),
      organizationId: session.user.organizationId,
      parameters: { walletId, targetPublicKey },
    });

    const exportBundle =
      response.activity.result.exportWalletResult?.exportBundle;
    if (exportBundle == null || embeddedKey == null) {
      throw new TurnkeyReactNativeError(
        "Export bundle, embedded key, or user not initialized",
      );
    }

    return await decryptExportBundle({
      exportBundle,
      embeddedKey,
      organizationId: session.user.organizationId,
      returnMnemonic: true,
    });
  };

  /**
   *
   * Signs a raw payload using the specified signing key and encoding parameters.
   *
   * @param signWith - The identifier of the signing key.
   * @param payload - The raw payload to be signed.
   * @param encoding - The encoding format of the payload.
   * @param hashFunction - The hash function to be used before signing.
   * @returns The result of the signing operation.
   * @throws If the client or user is not initialized.
   */
  const signRawPayload = async ({
    signWith,
    payload,
    encoding,
    hashFunction,
  }: {
    signWith: string;
    payload: string;
    encoding: PayloadEncoding;
    hashFunction: HashFunction;
  }): Promise<SignRawPayloadResult> => {
    if (client == null || session?.user == null) {
      throw new TurnkeyReactNativeError("Client or user not initialized");
    }

    const response = await client.signRawPayload({
      type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
      timestampMs: Date.now().toString(),
      organizationId: session.user.organizationId,
      parameters: {
        signWith,
        payload,
        encoding,
        hashFunction,
      },
    });

    const signRawPayloadResult = response.activity.result.signRawPayloadResult;
    if (signRawPayloadResult == null) {
      throw new TurnkeyReactNativeError("Failed to sign raw payload");
    }

    return signRawPayloadResult;
  };

  return (
    <TurnkeyContext.Provider
      value={{
        session,
        client,
        user: session?.user,
        setActiveSession,
        updateUser,
        refreshUser,
        createEmbeddedKey,
        createSession,
        clearSession,
        createWallet,
        importWallet,
        exportWallet,
        signRawPayload,
      }}
    >
      {children}
    </TurnkeyContext.Provider>
  );
};
