import { StorageKeys, User } from "@turnkey/sdk-browser";
import { useLocalStorage } from "usehooks-ts";

interface UserSession {
  user?: Omit<User, "session"> | undefined;
  session?: User["session"];
}

/**
 * Hook for managing the user session stored in local storage.
 * This hook is reactive and updates whenever the value in local storage changes.
 *
 * @returns {UserSession | undefined} An object containing user details and session information.
 *
 * @example
 * const { user, session } = useUserSession()
 *
 * if (user) {
 *   // user is defined and thus has previously logged in
 * } else {
 *   // no user found in local storage
 * }
 *
 * if (session?.read) {
 *   // session.read is defined therefore user is authenticated with a read session
 *   if (session.expiry && Date.now() < session.expiry) {
 *     // Session is still valid
 *   }
 * }
 *
 * if (session?.write) {
 *   // session.write is defined therefore user is authenticated with a read/write session
 *   if (session.expiry && Date.now() < session.expiry) {
 *     // Session is still valid
 *   }
 * }
 *
 * if (!session) {
 *   // no session, user is not authenticated
 * }
 */
export function useUserSession(): UserSession {
  const [user] = useLocalStorage<User | undefined>(
    StorageKeys.UserSession,
    undefined
  );

  const { session, userId, username, organization } = user ?? {};

  return {
    user:
      userId && organization
        ? {
            userId: userId ?? "",
            username: username ?? "",
            organization: organization ?? "",
          }
        : undefined,
    session: session ?? undefined,
  };
}
