export enum SessionType {
  READ_ONLY = "SESSION_TYPE_READ_ONLY",
  READ_WRITE = "SESSION_TYPE_READ_WRITE",
}

export type Session = {
  sessionType: SessionType;
  userId: string;
  organizationId: string;
  expiry: number;
  token: string;
};

export type SessionResponse = {
  session: Session;
  user: {
    id: string;
    name: string;
    email: string;
    organizationId: string;
    organizationName: string;
  };
};
