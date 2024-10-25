import type { AuthClient } from "./__types__/base";

/**
 * This interface defines the structure of user data that will be stored in local storage
 * when using one of the login methods.
 */
export interface User {
  // Unique identifier for the user.
  userId: string;

  // Username of the user.
  username: string;

  // Organization details associated with the user.
  organization: {
    // Unique identifier for the organization.
    organizationId: string;

    // Name of the organization.
    organizationName: string;
  };

  // Session information for the user, which can be either read-only or read-write.
  session:
    | {
        // Optional read-only session details.
        read?: ReadOnlySession;

        // Optional read-write session details.
        write?: ReadWriteSession;

        // Authenticated client associated with the session.
        authenticatedClient: AuthClient;
      }
    | undefined;
}

export interface ReadOnlySession {
  token: string;
  expiry: number;
}

export interface ReadWriteSession {
  credentialBundle: string;
  expiry: number;
}

export interface SubOrganization {
  organizationId: string;
  organizationName: string;
}

export type EmbeddedAPIKey = {
  authBundle: string;
  publicKey: string;
};

export type Passkey = {
  encodedChallenge: string;
  attestation: {
    credentialId: string;
    clientDataJson: string;
    attestationObject: string;
    transports: (
      | "AUTHENTICATOR_TRANSPORT_BLE"
      | "AUTHENTICATOR_TRANSPORT_INTERNAL"
      | "AUTHENTICATOR_TRANSPORT_NFC"
      | "AUTHENTICATOR_TRANSPORT_USB"
      | "AUTHENTICATOR_TRANSPORT_HYBRID"
    )[];
  };
};
