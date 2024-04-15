export interface User {
  userId: string;
  username: string;
}

export interface SubOrganization {
  organizationId: string;
  organizationName: string;
}

export interface SigningSession {
  publicKey: string;
  privateKey: string;
  expiration: number;
}
