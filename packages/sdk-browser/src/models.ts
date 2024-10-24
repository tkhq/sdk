import type { AuthClient } from "./__types__/base";

export interface User {
  userId: string;
  username: string;
  organization: {
    organizationId: string;
    organizationName: string;
  };
  session:
    | {
        read?: ReadOnlySession;
        write?: ReadWriteSession;
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
