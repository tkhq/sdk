"use client";

import { AuthClient, StorageKeys } from "@turnkey/sdk-browser";
import { useLocalStorage } from "usehooks-ts";
import type { Session } from "@turnkey/sdk-types";
/**
 * React hook to access the current Turnkey session and authentication client.
 *
 * This hook retrieves session and authClient values from local storage and reacts to changes.
 * It is primarily used to determine the user's authentication state and to sign requests.
 *
 * @returns {Object} An object containing:
 * - `session`: The current Turnkey session, or `undefined` if not set.
 * - `authClient`: The initialized Turnkey `AuthClient` used for signing requests, or `undefined` if not available.
 *
 * @example
 * const { session, authClient } = useSession();
 *
 * if (session && authClient) {
 *   // User is authenticated
 *   // You can use authClient to sign Turnkey requests
 * }
 */
export function useSession(): {
  session: Session | undefined;
  authClient: AuthClient | undefined;
} {
  const [session] = useLocalStorage<Session | undefined>(
    StorageKeys.Session,
    undefined,
  );
  const [authClient] = useLocalStorage<AuthClient | undefined>(
    StorageKeys.Client,
    undefined,
  );

  return { session, authClient };
}
