import type { ReactNode, FC } from "react";
import {
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
import type { TurnkeyClient } from "..";
import {
  TURNKEY_DEFAULT_SESSION_STORAGE,
  OTP_AUTH_DEFAULT_EXPIRATION_SECONDS,
} from "../constants";
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
  addSessionIdToIndex,
  clearSelectedSessionId,
  getEmbeddedKey,
  getSelectedSessionId,
  getSession,
  getSessionIdIndex,
  removeSessionIdFromIndex,
  deleteSession,
  saveEmbeddedKey,
  saveSelectedSessionId,
  saveSession,
} from "../storage";
import { createClient, fetchUser } from "../turnkey-helpers";

export interface TurnkeyContextType {
  session: Session | undefined;
  client: TurnkeyClient | undefined;
  user: User | undefined;
  setSelectedSession: (params: {
    sessionId: string;
  }) => Promise<Session | undefined>;
  updateUser: (params: { email?: string; phone?: string }) => Promise<Activity>;
  refreshUser: () => Promise<void>;
  createEmbeddedKey: () => Promise<string>;
  createSession: (params: {
    bundle: string;
    expirySeconds?: number;
    sessionId?: string;
  }) => Promise<Session>;
  clearSession: (params?: { sessionId?: string }) => Promise<void>;
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
  onSessionSelected?: (session: Session) => void;
  onSessionExpired?: (session: Session) => void;
  onSessionCleared?: (session: Session) => void;
}

export const TurnkeyProvider: FC<{
  children: ReactNode;
  config: TurnkeyConfig;
}> = ({ children, config }) => {
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [client, setClient] = useState<TurnkeyClient | undefined>(undefined);

  // map to track expiration timers for each session by sessionId
  const expiryTimeoutsRef = useRef<{ [id: string]: NodeJS.Timeout }>({});

  /**
   * Effect hook that initializes stored sessions on mount.
   *
   * This hook runs once when the component mounts. It retrieves all stored session ids,
   * validates their expiration status, removes expired sessions, and schedules expiration
   * timers for active ones. Additionally, it loads the last selected session if it is still valid,
   * otherwise it clears the session and triggers the session expiration callback.
   *
   * When the component unmounts, it clears all scheduled expiration timeouts.
   */
  useEffect(() => {
    const initializeSessions = async () => {
      const sessionIds = await getSessionIdIndex();

      await Promise.all(
        sessionIds.map(async (sessionId) => {
          const session = await getSession(sessionId);

          // if session is invalid, we remove it
          if (!session?.expiry || session.expiry <= Date.now()) {
            await clearSession({ sessionId });
            await removeSessionIdFromIndex(sessionId);
            return;
          }

          scheduleSessionExpiration(sessionId, session.expiry);
        }),
      );

      // load the selected session if it's still valid
      const selectedSessionId = await getSelectedSessionId();

      if (selectedSessionId) {
        const selectedSession = await getSession(selectedSessionId);

        if (selectedSession?.expiry && selectedSession.expiry > Date.now()) {
          const clientInstance = createClient(
            selectedSession.publicKey,
            selectedSession.privateKey,
            config.apiBaseUrl,
          );

          setSession(selectedSession);
          setClient(clientInstance);

          config.onSessionSelected?.(selectedSession);
        } else {
          await clearSession({ sessionId: selectedSessionId });

          config.onSessionExpired?.(
            selectedSession ?? ({ id: selectedSessionId } as Session),
          );
        }
      }
    };

    initializeSessions();

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
   * Schedules the expiration of a session.
   *
   * - Clears any existing timeout for the session to prevent duplicate timers.
   * - Determines the time remaining until the session expires.
   * - If the session is already expired, it triggers expiration immediately.
   * - Otherwise, schedules a timeout to expire the session at the appropriate time.
   * - Calls `clearSession` and invokes the `onSessionExpired` callback when the session expires.
   *
   * @param sessionId - The id identifying the session to schedule expiration for.
   * @param expiryTime - The timestamp (in milliseconds) when the session should expire.
   */
  const scheduleSessionExpiration = async (
    sessionId: string,
    expiryTime: number,
  ) => {
    // clear existing timeout if it exists
    if (expiryTimeoutsRef.current[sessionId]) {
      clearTimeout(expiryTimeoutsRef.current[sessionId]);
    }

    const expireSession = async () => {
      const expiredSession = await getSession(sessionId);
      if (!expiredSession) return;

      await clearSession({ sessionId });

      config.onSessionExpired?.(expiredSession);
      delete expiryTimeoutsRef.current[sessionId];
    };

    const timeUntilExpiry = expiryTime - Date.now();

    if (timeUntilExpiry <= 0) {
      await expireSession();
    } else {
      // schedule expiration
      expiryTimeoutsRef.current[sessionId] = setTimeout(
        expireSession,
        timeUntilExpiry,
      );
    }
  };

  /**
   * Sets the selected session and updates the client instance.
   *
   * - Retrieves the session associated with the given `sessionId`.
   * - If the session is valid, initializes a new `TurnkeyClient` and updates the state.
   * - Saves the selected session id and triggers `onSessionSelected` if provided.
   * - If the session is expired or invalid, clears the session and triggers `onSessionExpired`.
   *
   * @param sessionId - The id of the session to set as selected.
   * @returns The selected session if valid, otherwise `undefined`.
   */
  const setSelectedSession = useCallback(
    async ({ sessionId }: { sessionId: string }) => {
      const session = await getSession(sessionId);

      if (session?.expiry && session.expiry > Date.now()) {
        const clientInstance = createClient(
          session.publicKey,
          session.privateKey,
          config.apiBaseUrl,
        );

        setClient(clientInstance);
        setSession(session);
        await saveSelectedSessionId(sessionId);

        config.onSessionSelected?.(session);
        return session;
      } else {
        await clearSession({ sessionId });
        config.onSessionExpired?.(session ?? ({ id: sessionId } as Session));
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
        await saveSession(updatedSession, updatedSession.id);
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
   * @param email - The new email address (optional).
   * @param phone - The new phone number (optional).
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
   * @returns The public key corresponding to the generated embedded key pair.
   * @throws If saving the private key fails.
   */
  const createEmbeddedKey = useCallback(async () => {
    const key = generateP256KeyPair();
    const embeddedPrivateKey = key.privateKey;
    const publicKey = key.publicKeyUncompressed;
    await saveEmbeddedKey(embeddedPrivateKey);
    return publicKey;
  }, []);

  /**
   * Creates a new session and securely stores it.
   *
   * - Retrieves the embedded private key from secure storage.
   * - Decrypts the provided session bundle using the embedded key.
   * - Extracts the public key from the decrypted private key.
   * - Creates a new Turnkey API client using the derived credentials.
   * - Fetches user information associated with the session.
   * - Constructs and saves the session in secure storage.
   * - Schedules session expiration handling.
   * - If this is the first session, it is automatically set as the selected session.
   * - Calls `onSessionCreated` callback if provided.
   *
   * @param bundle - The encrypted credential bundle.
   * @param expirySeconds - Optional expiration time in seconds (defaults to `OTP_AUTH_DEFAULT_EXPIRATION_SECONDS`).
   * @param sessionId - Optional session identifier (defaults to `TURNKEY_DEFAULT_SESSION_STORAGE`).
   * @returns The created session.
   * @throws {TurnkeyReactNativeError} If the embedded key or user data cannot be retrieved.
   */
  const createSession = useCallback(
    async ({
      bundle,
      expirySeconds = OTP_AUTH_DEFAULT_EXPIRATION_SECONDS,
      sessionId = TURNKEY_DEFAULT_SESSION_STORAGE,
    }: {
      bundle: string;
      expirySeconds?: number;
      sessionId?: string;
    }): Promise<Session> => {
      const embeddedKey = await getEmbeddedKey();
      if (!embeddedKey) {
        throw new TurnkeyReactNativeError("Embedded key not found.");
      }

      const privateKey = decryptCredentialBundle(bundle, embeddedKey);
      const publicKey = uint8ArrayToHexString(getPublicKey(privateKey));
      const expiry = Date.now() + expirySeconds * 1000;

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
        id: sessionId,
        publicKey,
        privateKey,
        expiry,
        user,
      };
      await saveSession(newSession, sessionId);
      await addSessionIdToIndex(sessionId);
      scheduleSessionExpiration(sessionId, newSession.expiry);

      // if this is the first session created, set it as the selected session
      const sessionIds = await getSessionIdIndex();
      const isFirstSession = sessionIds.length === 1;

      if (isFirstSession) {
        await setSelectedSession({ sessionId });
      }

      config.onSessionCreated?.(newSession);
      return newSession;
    },
    [config, setSelectedSession],
  );

  /**
   * Clears a session and removes it from secure storage.
   *
   * - Retrieves the session associated with the given `sessionId`.
   * - If the session being cleared is the currently selected session, it resets the state.
   * - Deletes the session from secure storage.
   * - Removes the session id from the session index.
   * - Calls `onSessionCleared` callback if provided.
   *
   * @param sessionId - The id identifying the session to clear (defaults to `TURNKEY_DEFAULT_SESSION_STORAGE`).
   * @throws {TurnkeyReactNativeError} If the session cannot be cleared.
   */
  const clearSession = useCallback(
    async ({
      sessionId = TURNKEY_DEFAULT_SESSION_STORAGE,
    }: {
      sessionId?: string;
    } = {}): Promise<void> => {
      const clearedSession = await getSession(sessionId);

      // if selected session is being cleared, clear the local state session and client
      if (session?.id === sessionId) {
        setSession(undefined);
        setClient(undefined);
        await clearSelectedSessionId();
      }

      await deleteSession(sessionId);
      await removeSessionIdFromIndex(sessionId);

      config.onSessionCleared?.(
        clearedSession ?? ({ id: sessionId } as Session),
      );
    },
    [session, config],
  );

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
      clearSession,
      createWallet,
      importWallet,
      exportWallet,
      signRawPayload,
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
      clearSession,
      createWallet,
      importWallet,
      exportWallet,
      signRawPayload,
    ],
  );

  return (
    <TurnkeyContext.Provider value={providerValue}>
      {children}
    </TurnkeyContext.Provider>
  );
};
