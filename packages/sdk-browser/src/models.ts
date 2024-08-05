export interface User {
  userId: string;
  username: string;
  organization: SubOrganization;
  readOnlySession?: ReadOnlySession;
}

export interface ReadOnlySession {
  session: string;
  sessionExpiry: number;
}

export interface ReadWriteSession {
  authBundle: string;
  sessionExpiry: number;
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
