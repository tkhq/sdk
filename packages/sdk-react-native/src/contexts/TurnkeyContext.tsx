import {
  type ReactNode,
  type FC,
  createContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  generateP256KeyPair,
  getPublicKey,
  decryptCredentialBundle,
  encryptWalletToBundle,
  decryptExportBundle,
} from "@turnkey/crypto";
import { uint8ArrayToHexString } from "@turnkey/encoding";
import type { TurnkeyClient } from "@turnkey/http";
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
import {
  clearSelectedSessionKey,
  getEmbeddedKey,
  getSelectedSessionKey,
  getSession,
  deleteSession,
  saveEmbeddedKey,
  saveSelectedSessionKey,
  saveSession,
  getSessionKeys,
  removeSessionKey,
  addSessionKey,
} from "../storage";
import { createClient, fetchUser, isValidSession } from "../turnkey-helpers";
import {
  MAX_SESSIONS,
  OTP_AUTH_DEFAULT_EXPIRATION_SECONDS,
  SESSION_WARNING_THRESHOLD_SECONDS,
  StorageKeys,
  TURNKEY_OAUTH_ORIGIN_URL,
  TURNKEY__OAUTH_REDIRECT_URL,
} from "../constants";
import { InAppBrowser } from "react-native-inappbrowser-reborn";

export interface TurnkeyContextType {
  session: Session | undefined;
  client: TurnkeyClient | undefined;
  user: User | undefined;
  setSelectedSession: (params: {
    sessionKey: string;
  }) => Promise<Session | undefined>;
  updateUser: (params: { email?: string; phone?: string }) => Promise<Activity>;
  refreshUser: () => Promise<void>;
  createEmbeddedKey: (params?: {
    storageKey?: string;
    isCompressed?: boolean;
  }) => Promise<string>;
  createSession: (params: {
    bundle: string;
    expirationSeconds?: number;
    embeddedStorageKey?: string;
    sessionKey?: string;
  }) => Promise<Session>;
  createSessionFromEmbeddedKey: (params: {
    subOrganizationId: string;
    embeddedKey?: string;
    expirationSeconds?: number;
    embeddedStorageKey?: string;
    sessionKey?: string;
  }) => Promise<Session>;
  refreshSession: (params?: {
    expirationSeconds?: number;
    sessionKey?: string;
  }) => Promise<Session>;
  clearSession: (params?: { sessionKey?: string }) => Promise<void>;
  clearAllSessions: () => Promise<void>;
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
  handleGoogleOAuth: (params: {
    clientId: string;
    nonce: string;
    scheme: string;
    originUri?: string;
    redirectUri?: string;
    onSuccess: (oidcToken: string) => void;
  }) => Promise<void>;
}

export const TurnkeyContext = createContext<TurnkeyContextType | undefined>(
  undefined,
);

export interface TurnkeyConfig {
  apiBaseUrl: string;
  organizationId: string;
  onSessionCreated?: (session: Session) => void;
  onSessionSelected?: (session: Session) => void;
  onSessionExpired?: (session: Session) => void;
  onSessionCleared?: (session: Session) => void;
  onSessionEmpty?: () => void;
  onInitialized?: () => void;
  onSessionExpiryWarning?: (session: Session) => void;
}

export const TurnkeyProvider: FC<{
  children: ReactNode;
  config: TurnkeyConfig;
}> = ({ children, config }) => {
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [client, setClient] = useState<TurnkeyClient | undefined>(undefined);

  // map to track expiration timers for each session by session key
  const expiryTimeoutsRef = useRef<{ [id: string]: NodeJS.Timeout }>({});

  /**
   * Effect hook that initializes stored sessions on mount.
   *
   * This hook runs once when the component mounts. It retrieves all stored session keys,
   * validates their expiration status, removes expired sessions, and schedules expiration
   * timers for active ones. Additionally, it loads the last selected session if it is still valid,
   * otherwise it clears the session and triggers the session expiration callback.
   *
   * When the component unmounts, it clears all scheduled expiration timeouts.
   */
  useEffect(() => {
    const initializeSessions = async () => {
      const sessionKeys = await getSessionKeys();

      await Promise.all(
        sessionKeys.map(async (sessionKey) => {
          const session = await getSession(sessionKey);

          // if session is invalid, we remove it
          if (!isValidSession(session)) {
            await clearSession({ sessionKey });
            await removeSessionKey(sessionKey);
            return;
          }

          scheduleSessionExpiration(sessionKey, session!.expiry);
        }),
      );

      // load the selected session if it's still valid
      const selectedSessionKey = await getSelectedSessionKey();

      if (selectedSessionKey) {
        const selectedSession = await getSession(selectedSessionKey);

        if (isValidSession(selectedSession)) {
          const clientInstance = createClient(
            selectedSession!.publicKey,
            selectedSession!.privateKey,
            config.apiBaseUrl,
          );

          setSession(selectedSession!);
          setClient(clientInstance);

          config.onSessionSelected?.(selectedSession!);
        } else {
          await clearSession({ sessionKey: selectedSessionKey });

          config.onSessionExpired?.(
            selectedSession ?? ({ key: selectedSessionKey } as Session),
          );
        }
      } else {
        config.onSessionEmpty?.();
      }
    };

    initializeSessions();
    config.onInitialized?.();
    return () => {
      clearTimeouts();
    };
  }, []);

  /**
   * Clears all scheduled session expiration timeouts.
   *
   * - Iterates over the currently tracked expiration timers and clears each one.
   * - Resets the `expiryTimeoutsRef` object to an empty state.
   */
  const clearTimeouts = () => {
    Object.values(expiryTimeoutsRef.current).forEach((timer) =>
      clearTimeout(timer),
    );
    expiryTimeoutsRef.current = {};
  };

  /**
   * Schedules the expiration and pre-expiration warning of a session.
   *
   * - Clears any existing expiration and warning timeouts for the session.
   * - Computes the remaining time until the session expires.
   * - If the session is already expired, triggers expiration immediately.
   * - If the remaining time is less than or equal to the warning threshold (30 seconds),
   *   triggers the warning callback immediately; otherwise, schedules the warning to fire 30 seconds before expiration.
   * - Always schedules a timeout to expire the session at the appropriate time.
   * - Upon expiration, invokes clearSession and the onSessionExpired callback.
   *
   * @param sessionKey - The key identifying the session for which to schedule expiration.
   * @param expiryTime - The expiration timestamp (in milliseconds) of the session.
   */
  const scheduleSessionExpiration = async (
    sessionKey: string,
    expiryTime: number,
  ) => {
    // clear existing timeout if it exists
    if (expiryTimeoutsRef.current[sessionKey]) {
      clearTimeout(expiryTimeoutsRef.current[sessionKey]);
    }

    // clear existing warning timeouts if it exists
    if (expiryTimeoutsRef.current[`${sessionKey}-warning`]) {
      clearTimeout(expiryTimeoutsRef.current[`${sessionKey}-warning`]);
    }

    const timeUntilExpiry = expiryTime - Date.now();
    const warningThreshold = SESSION_WARNING_THRESHOLD_SECONDS * 1000;

    const warnBeforeExpiry = async () => {
      const session = await getSession(sessionKey);
      if (!session) return;

      config.onSessionExpiryWarning?.(session);
      delete expiryTimeoutsRef.current[`${sessionKey}-warning`];
    };

    const expireSession = async () => {
      const expiredSession = await getSession(sessionKey);
      if (!expiredSession) return;

      await clearSession({ sessionKey });

      config.onSessionExpired?.(expiredSession);
      delete expiryTimeoutsRef.current[sessionKey];
      delete expiryTimeoutsRef.current[`${sessionKey}-warning`];
    };

    if (timeUntilExpiry <= 0) {
      await expireSession();
      return;
    }

    // if it is less than warning threshold, we warn immediately
    if (timeUntilExpiry <= warningThreshold) {
      warnBeforeExpiry();
    } else {
      // schedule warning
      expiryTimeoutsRef.current[`${sessionKey}-warning`] = setTimeout(
        warnBeforeExpiry,
        timeUntilExpiry - warningThreshold,
      );
    }

    // schedule expiration
    expiryTimeoutsRef.current[sessionKey] = setTimeout(
      expireSession,
      timeUntilExpiry,
    );
  };

  /**
   * Sets the selected session and updates the client instance.
   *
   * - Retrieves the session associated with the given `sessionKey`.
   * - If the session is valid, initializes a new `TurnkeyClient` and updates the state.
   * - Saves the selected session key and triggers `onSessionSelected` if provided.
   * - If the session is expired or invalid, clears the session and triggers `onSessionExpired`.
   *
   * @param sessionKey - The key of the session to set as selected.
   * @returns The selected session if valid, otherwise `undefined`.
   */
  const setSelectedSession = useCallback(
    async ({ sessionKey }: { sessionKey: string }) => {
      const session = await getSession(sessionKey);

      if (isValidSession(session)) {
        const clientInstance = createClient(
          session!.publicKey,
          session!.privateKey,
          config.apiBaseUrl,
        );

        setClient(clientInstance);
        setSession(session!);
        await saveSelectedSessionKey(sessionKey);

        config.onSessionSelected?.(session!);
        return session!;
      } else {
        await clearSession({ sessionKey });
        config.onSessionExpired?.(session ?? ({ key: sessionKey } as Session));
        return undefined;
      }
    },
    [createClient, config],
  );

  /**
   * Refreshes the current user data.
   *
   * - Fetches the latest user details from the API using the current session's client.
   * - If the user data is successfully retrieved, updates the session with the new user details.
   * - Saves the updated session and updates the state.
   *
   * @throws If the session or client is not initialized.
   */
  const refreshUser = useCallback(async () => {
    if (session && client) {
      const updatedUser = await fetchUser(client, config.organizationId);
      if (updatedUser) {
        const updatedSession: Session = { ...session, user: updatedUser };
        await saveSession(updatedSession, updatedSession.key);
        setSession(updatedSession);
      }
    }
  }, [session, client, config.organizationId]);

  /**
   * Updates the current user's information.
   *
   * - Sends a request to update the user's email and/or phone number.
   * - If the update is successful, refreshes the user data to reflect changes.
   *
   * @param email - (Optional) The new email address.
   * @param phone - (Optional) The new phone number.
   * @returns The update user activity result.
   * @throws If the client or session is not initialized.
   */
  const updateUser = useCallback(
    async ({ email, phone }: { email?: string; phone?: string }) => {
      if (client == null || session?.user == null) {
        throw new TurnkeyReactNativeError("Client or user not initialized");
      }

      const parameters = {
        userId: session.user.id,
        userTagIds: [] as string[],
        ...(phone?.trim() && { userPhoneNumber: phone }),
        ...(email?.trim() && { userEmail: email }),
      };

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
    },
    [client, session, refreshUser],
  );

  /**
   * Generates a new embedded key pair and securely stores the private key in secure storage.
   *
   * - By default, returns the uncompressed public key.
   * - If `isCompressed` is set to `true`, returns the compressed public key instead.
   *
   * @param storageKey - (Optional) The storage key under which to store the private key (defaults to `@turnkey/embedded-key`).
   * @param isCompressed - (Optional) Whether to return the compressed public key (defaults to `false`).
   * @returns The public key (compressed or uncompressed) corresponding to the generated embedded key pair.
   * @throws {TurnkeyReactNativeError} If saving the private key fails.
   */
  const createEmbeddedKey = useCallback(
    async ({
      storageKey = StorageKeys.EmbeddedKey,
      isCompressed = false,
    }: {
      storageKey?: string;
      isCompressed?: boolean;
    } = {}) => {
      const key = generateP256KeyPair();

      const embeddedPrivateKey = key.privateKey;
      const publicKey = key.publicKey;
      const publicKeyUncompressed = key.publicKeyUncompressed;

      await saveEmbeddedKey(embeddedPrivateKey, storageKey);

      return isCompressed ? publicKey : publicKeyUncompressed;
    },
    [],
  );

  /**
   * Creates a new session and securely stores it.
   *
   * - Enforces a maximum limit of `MAX_SESSIONS` to prevent excessive resource usage.
   * - Retrieves the embedded private key from secure storage.
   * - Decrypts the provided session bundle using the embedded key.
   * - Extracts the public key from the decrypted private key.
   * - Creates a new Turnkey API client using the derived credentials.
   * - Fetches user information associated with the session.
   * - Constructs and saves the session in secure storage.
   * - Schedules session expiration handling.
   * - If this is the first session created, it is automatically set as the selected session.
   * - Calls `onSessionCreated` callback if provided.
   *
   * @param bundle - The encrypted credential bundle.
   * @param expirationSeconds - (Optional) The expiration time in seconds (defaults to `OTP_AUTH_DEFAULT_EXPIRATION_SECONDS`).
   * @param embeddedStorageKey - (Optional) The service key where the embedded key is stored (defaults to `@turnkey/embedded-key`).
   * @param sessionKey - (Optional) The session identifier (defaults to `TURNKEY_DEFAULT_SESSION_STORAGE`).
   * @returns The created session.
   * @throws {TurnkeyReactNativeError} If the embedded key or user data cannot be retrieved,
   *         if the sessionKey already exists, or if the maximum session limit is reached.
   */
  const createSession = useCallback(
    async ({
      bundle,
      expirationSeconds = OTP_AUTH_DEFAULT_EXPIRATION_SECONDS,
      embeddedStorageKey = StorageKeys.EmbeddedKey,
      sessionKey = StorageKeys.DefaultSession,
    }: {
      bundle: string;
      expirationSeconds?: number;
      embeddedStorageKey?: string;
      sessionKey?: string;
    }): Promise<Session> => {
      // we throw an error if a session with this sessionKey already exists
      const existingSessionKeys = await getSessionKeys();

      if (existingSessionKeys.length >= MAX_SESSIONS) {
        throw new TurnkeyReactNativeError(
          `Maximum session limit of ${MAX_SESSIONS} reached. Please clear an existing session before creating a new one.`,
        );
      }

      if (existingSessionKeys.includes(sessionKey)) {
        throw new TurnkeyReactNativeError(
          `session key "${sessionKey}" already exists. Please choose a unique session key or clear the existing session.`,
        );
      }

      const embeddedKey = await getEmbeddedKey(true, embeddedStorageKey);
      if (!embeddedKey) {
        throw new TurnkeyReactNativeError("Embedded key not found.");
      }

      const privateKey = decryptCredentialBundle(bundle, embeddedKey);
      const publicKey = uint8ArrayToHexString(getPublicKey(privateKey));
      const expiry = Date.now() + expirationSeconds * 1000;

      const clientInstance = createClient(
        publicKey,
        privateKey,
        config.apiBaseUrl,
      );
      const user = await fetchUser(clientInstance, config.organizationId);
      if (!user) {
        throw new TurnkeyReactNativeError("User not found.");
      }

      const newSession = {
        key: sessionKey,
        publicKey,
        privateKey,
        expiry,
        user,
      };
      await saveSession(newSession, sessionKey);
      await addSessionKey(sessionKey);
      scheduleSessionExpiration(sessionKey, newSession.expiry);

      // if this is the first session created, set it as the selected session
      const isFirstSession = existingSessionKeys.length === 0;
      if (isFirstSession) {
        await setSelectedSession({ sessionKey });
      }

      config.onSessionCreated?.(newSession);
      return newSession;
    },
    [config, setSelectedSession],
  );

  /**
   * Creates a new session using an embedded private key and securely stores it.
   *
   * - Enforces a maximum limit of `MAX_SESSIONS` to prevent excessive resource usage.
   * - Retrieves the embedded private key from secure storage or uses the provided one.
   * - Extracts the public key from the private key.
   * - Creates a new Turnkey API client using the derived credentials.
   * - Fetches user information associated with the session.
   * - Constructs and saves the session in secure storage.
   * - Schedules session expiration handling.
   * - If this is the first session created, it is automatically set as the selected session.
   * - Calls `onSessionCreated` callback if provided.
   *
   * @param subOrganizationId - The sub-organization ID used to fetch user information.
   * @param embeddedKey - (Optional) A private key to use instead of fetching from secure storage.
   * @param embeddedStorageKey - (Optional) The storage key where the embedded key is stored. Only used if `embeddedKey` is not provided (defaults to `@turnkey/embedded-key`).
   * @param expirationSeconds - (Optional) The expiration time in seconds (defaults to `OTP_AUTH_DEFAULT_EXPIRATION_SECONDS`).
   * @param sessionKey - (Optional) The session identifier (defaults to `TURNKEY_DEFAULT_SESSION_STORAGE`).
   * @returns The created session.
   * @throws {TurnkeyReactNativeError} If the embedded key or user data cannot be retrieved,
   *         if the sessionKey already exists, or if the maximum session limit is reached.
   */
  const createSessionFromEmbeddedKey = useCallback(
    async ({
      subOrganizationId,
      embeddedKey,
      expirationSeconds = OTP_AUTH_DEFAULT_EXPIRATION_SECONDS,
      embeddedStorageKey = StorageKeys.EmbeddedKey,
      sessionKey = StorageKeys.DefaultSession,
    }: {
      subOrganizationId: string;
      embeddedKey?: string;
      expirationSeconds?: number;
      embeddedStorageKey?: string;
      sessionKey?: string;
    }): Promise<Session> => {
      // we throw an error if a session with this sessionKey already exists
      const existingSessionKeys = await getSessionKeys();

      if (existingSessionKeys.length >= MAX_SESSIONS) {
        throw new TurnkeyReactNativeError(
          `Maximum session limit of ${MAX_SESSIONS} reached. Please clear an existing session before creating a new one.`,
        );
      }

      if (existingSessionKeys.includes(sessionKey)) {
        throw new TurnkeyReactNativeError(
          `session key "${sessionKey}" already exists. Please choose a unique session key or clear the existing session.`,
        );
      }

      const privateKey =
        embeddedKey ?? (await getEmbeddedKey(true, embeddedStorageKey));
      if (!privateKey) {
        throw new TurnkeyReactNativeError("Embedded key not found.");
      }
      const publicKey = uint8ArrayToHexString(getPublicKey(privateKey));
      const expiry = Date.now() + expirationSeconds * 1000;

      const clientInstance = createClient(
        publicKey,
        privateKey,
        config.apiBaseUrl,
      );
      const user = await fetchUser(clientInstance, subOrganizationId);
      if (!user) {
        throw new TurnkeyReactNativeError("User not found.");
      }

      const newSession = {
        key: sessionKey,
        publicKey,
        privateKey,
        expiry,
        user,
      };
      await saveSession(newSession, sessionKey);
      await addSessionKey(sessionKey);
      scheduleSessionExpiration(sessionKey, newSession.expiry);

      // if this is the first session created, set it as the selected session
      const isFirstSession = existingSessionKeys.length === 0;
      if (isFirstSession) {
        await setSelectedSession({ sessionKey });
      }

      config.onSessionCreated?.(newSession);
      return newSession;
    },
    [config, setSelectedSession],
  );

  /**
   * Refreshes an existing session by creating a new read/write session.
   *
   * This function refreshes an existing session by:
   *  - Retrieving the session using the provided or selected session key.
   *  - Verifying that the session is still valid.
   *  - Generating a new embedded key for refreshing.
   *  - Creating a new read/write session via the current session client.
   *  - Decrypting the returned credential bundle to derive new keys and expiry.
   *  - Fetching updated user information using the new credentials.
   *  - Updating local state (if this is the currently selected session),
   *    saving the refreshed session, and scheduling its expiration.
   *
   * @param expirationSeconds - (Optional) The expiration time in seconds for the new session. Defaults to OTP_AUTH_DEFAULT_EXPIRATION_SECONDS.
   * @param sessionKey - (Optional) The session key to refresh; if not provided, the currently selected session key is used.
   * @returns The refreshed Session.
   * @throws {TurnkeyReactNativeError} If the session is not found, already expired, or any step in the refresh fails.
   */
  const refreshSession = useCallback(
    async ({
      expirationSeconds = OTP_AUTH_DEFAULT_EXPIRATION_SECONDS,
      sessionKey,
    }: {
      expirationSeconds?: number;
      sessionKey?: string;
    } = {}): Promise<Session> => {
      const keyToRefresh = sessionKey ?? (await getSelectedSessionKey());
      if (!keyToRefresh) {
        throw new TurnkeyReactNativeError(
          "Session not found when refreshing the session. Either the provided sessionKey is invalid, or no session is currently selected.",
        );
      }

      const sessionToRefresh = await getSession(keyToRefresh);
      if (!isValidSession(sessionToRefresh)) {
        throw new TurnkeyReactNativeError(
          `You cannot refresh session with key "${keyToRefresh}" because it is already expired.`,
        );
      }

      const {
        publicKeyUncompressed: targetPublicKey,
        privateKey: embeddedKey,
      } = generateP256KeyPair();

      const currentClient = createClient(
        sessionToRefresh!.publicKey,
        sessionToRefresh!.privateKey,
        config.apiBaseUrl,
      );
      const sessionResponse = await currentClient.createReadWriteSession({
        type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
        timestampMs: Date.now().toString(),
        organizationId: config.organizationId,
        parameters: {
          targetPublicKey,
          expirationSeconds: expirationSeconds.toString(),
        },
      });
      const bundle =
        sessionResponse.activity.result.createReadWriteSessionResultV2
          ?.credentialBundle;
      if (!bundle) {
        throw new TurnkeyReactNativeError(
          "Failed to create read/write session when refreshing the session",
        );
      }

      const newPrivateKey = decryptCredentialBundle(bundle, embeddedKey);
      const newPublicKey = uint8ArrayToHexString(getPublicKey(newPrivateKey));
      const newExpiry = Date.now() + expirationSeconds * 1000;

      const newClient = createClient(
        newPublicKey,
        newPrivateKey,
        config.apiBaseUrl,
      );
      const user = await fetchUser(newClient, config.organizationId);
      if (!user) {
        throw new TurnkeyReactNativeError(
          "User not found when refreshing the session",
        );
      }

      const newSession: Session = {
        key: keyToRefresh,
        publicKey: newPublicKey,
        privateKey: newPrivateKey,
        expiry: newExpiry,
        user,
      };

      // if selected session is being refreshed, we update the local state session and client
      if (session?.key === keyToRefresh) {
        setSession(newSession);
        setClient(newClient);
      }

      await saveSession(newSession, keyToRefresh);
      scheduleSessionExpiration(keyToRefresh, newSession.expiry);

      return newSession;
    },
    [config, session],
  );

  /**
   * Removes a session from secure storage.
   *
   * - If `sessionKey` is provided, removes the specified session.
   * - If no `sessionKey` is provided, removes the currently selected session.
   * - If the session being removed is the currently selected session, resets the state.
   * - Deletes the session from secure storage and updates the session index.
   * - Calls `onSessionCleared` callback if provided.
   *
   * @param sessionKey - The key of the session to clear. Defaults to the currently selected session.
   * @throws {TurnkeyReactNativeError} If the provided `sessionKey` does not exist or no session is currently selected.
   */
  const clearSession = useCallback(
    async ({
      sessionKey,
    }: {
      sessionKey?: string;
    } = {}): Promise<void> => {
      const keyToClear = sessionKey ?? (await getSelectedSessionKey());

      if (!keyToClear) {
        throw new TurnkeyReactNativeError(
          "Session not found. Either the provided sessionKey is invalid, or no session is currently selected.",
        );
      }

      const clearedSession = await getSession(keyToClear);

      // if selected session is being cleared, clear the local state session and client
      if (session?.key === keyToClear) {
        setSession(undefined);
        setClient(undefined);
        await clearSelectedSessionKey();
      }

      await deleteSession(keyToClear);
      await removeSessionKey(keyToClear);

      clearTimeout(expiryTimeoutsRef.current[keyToClear]);
      delete expiryTimeoutsRef.current[keyToClear];

      config.onSessionCleared?.(
        clearedSession ?? ({ key: keyToClear } as Session),
      );
    },
    [session, config],
  );

  /**
   * Clears all sessions from secure storage.
   *
   * - Retrieves all stored session keys.
   * - For each session key, deletes the associated session and removes the key from the session index.
   * - Clears the selected session key from secure storage.
   * - Resets local state (active session and client).
   * - Clears all scheduled expiration timers.
   *
   * @throws {TurnkeyReactNativeError} If any error occurs during the clearing process.
   */
  const clearAllSessions = useCallback(async (): Promise<void> => {
    try {
      const sessionKeys = await getSessionKeys();

      for (const key of sessionKeys) {
        await deleteSession(key);
        await removeSessionKey(key);
      }

      await clearSelectedSessionKey();

      setSession(undefined);
      setClient(undefined);

      clearTimeouts();
    } catch (error) {
      throw new TurnkeyReactNativeError("Failed to clear all sessions", error);
    }
  }, [clearTimeouts]);

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
  const createWallet = useCallback(
    async ({
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

      const parameters: any = { walletName, accounts };
      if (mnemonicLength != null) {
        parameters.mnemonicLength = mnemonicLength;
      }

      const response = await client.createWallet({
        type: "ACTIVITY_TYPE_CREATE_WALLET",
        timestampMs: Date.now().toString(),
        organizationId: session.user.organizationId,
        parameters,
      });

      const activity = response.activity;
      if (activity.result.createWalletResult?.walletId) {
        await refreshUser();
      }

      return activity;
    },
    [client, session, refreshUser],
  );

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
  const importWallet = useCallback(
    async ({
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
    },
    [client, session, refreshUser],
  );

  /**
   *
   * Exports an existing wallet by decrypting the stored mnemonic phrase.
   *
   * @param walletId - The unique identifier of the wallet to be exported.
   * @returns The decrypted mnemonic phrase of the wallet.
   * @throws If the client, user, or export bundle is not initialized.
   */
  const exportWallet = useCallback(
    async ({ walletId }: { walletId: string }): Promise<string> => {
      const {
        publicKeyUncompressed: targetPublicKey,
        privateKey: embeddedKey,
      } = generateP256KeyPair();

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
          "Export bundle or embedded key not initialized",
        );
      }

      return await decryptExportBundle({
        exportBundle,
        embeddedKey,
        organizationId: session.user.organizationId,
        returnMnemonic: true,
      });
    },
    [client, session],
  );

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
  const signRawPayload = useCallback(
    async ({
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
        parameters: { signWith, payload, encoding, hashFunction },
      });

      const signRawPayloadResult =
        response.activity.result.signRawPayloadResult;

      if (signRawPayloadResult == null) {
        throw new TurnkeyReactNativeError("Failed to sign raw payload");
      }

      return signRawPayloadResult;
    },
    [client, session],
  );

  /**
   * Handles the Google OAuth authentication flow.
   *
   * Initiates an InAppBrowser OAuth flow with the provided credentials and parameters.
   * After the OAuth flow completes successfully, it extracts the oidcToken from the callback URL
   * and invokes the provided onSuccess callback.
   *
   * @param clientId    The client ID for Google OAuth.
   * @param nonce       A random nonce for the OAuth flow.
   * @param scheme      The app’s custom URL scheme (e.g., `"myapp"`).
   * @param originUri   (Optional) The base URI to start the OAuth flow. Defaults to `TURNKEY_OAUTH_ORIGIN_URL`.
   * @param redirectUri (Optional) The redirect URI for the OAuth flow. Defaults to `TURNKEY_OAUTH_REDIRECT_URL?scheme={scheme}`.
   * @param onSuccess   Callback function that receives the oidcToken upon successful OAuth authentication.
   * @returns           A promise that resolves once the OAuth flow completes.
   * @throws {TurnkeyReactNativeError} If InAppBrowser is unavailable, the OAuth flow fails, or the oidcToken is missing.
   */
  const handleGoogleOAuth = useCallback(
    async ({
      clientId,
      nonce,
      scheme,
      originUri = TURNKEY_OAUTH_ORIGIN_URL,
      redirectUri,
      onSuccess,
    }: {
      clientId: string;
      nonce: string;
      scheme: string;
      originUri?: string;
      redirectUri?: string;
      onSuccess: (oidcToken: string) => void;
    }): Promise<void> => {
      if (!(await InAppBrowser.isAvailable())) {
        throw new TurnkeyReactNativeError("InAppBrowser is not available");
      }

      const finalRedirectUri = redirectUri
        ? redirectUri
        : `${TURNKEY__OAUTH_REDIRECT_URL}?scheme=${encodeURIComponent(scheme)}`;

      const oauthUrl =
        originUri +
        `?provider=google` +
        `&clientId=${encodeURIComponent(clientId)}` +
        `&redirectUri=${encodeURIComponent(finalRedirectUri)}` +
        `&nonce=${encodeURIComponent(nonce)}`;

      const result = await InAppBrowser.openAuth(oauthUrl, scheme, {
        dismissButtonStyle: "cancel",
        animated: true,
        modalPresentationStyle: "fullScreen",
        modalTransitionStyle: "coverVertical",
        modalEnabled: true,
        enableBarCollapsing: false,
        showTitle: true,
        enableUrlBarHiding: true,
        enableDefaultShare: true,
      });

      if (!result || result.type !== "success" || !result.url) {
        throw new TurnkeyReactNativeError(
          "OAuth flow did not complete successfully",
        );
      }

      const resultUrl = new URL(result.url);
      const oidcToken = resultUrl.searchParams.get("id_token");

      if (!oidcToken) {
        throw new TurnkeyReactNativeError(
          "oidcToken not found in the response",
        );
      }

      onSuccess(oidcToken);
    },
    [],
  );

  const providerValue = useMemo(
    () => ({
      session,
      client,
      user: session?.user,
      setSelectedSession,
      refreshUser,
      updateUser,
      createEmbeddedKey,
      createSession,
      createSessionFromEmbeddedKey,
      refreshSession,
      clearSession,
      clearAllSessions,
      createWallet,
      importWallet,
      exportWallet,
      signRawPayload,
      handleGoogleOAuth,
    }),
    [
      session,
      client,
      session?.user,
      setSelectedSession,
      refreshUser,
      updateUser,
      createEmbeddedKey,
      createSession,
      createSessionFromEmbeddedKey,
      refreshSession,
      clearSession,
      clearAllSessions,
      createWallet,
      importWallet,
      exportWallet,
      signRawPayload,
      handleGoogleOAuth,
    ],
  );

  return (
    <TurnkeyContext.Provider value={providerValue}>
      {children}
    </TurnkeyContext.Provider>
  );
};
