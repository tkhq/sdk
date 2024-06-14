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

export interface SubOrganization {
  organizationId: string;
  organizationName: string;
}

export type EmbeddedAPIKey = {
  authBundle: string;
  publicKey: string;
};

export interface SigningSession {
  authBundle: string;
  expirationTimestamp: number;
}
