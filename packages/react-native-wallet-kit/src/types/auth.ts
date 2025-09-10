export interface AuthState {
  isAuthenticated: boolean;
  userId?: string;
  userName?: string;
}

export interface AuthMethods {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}