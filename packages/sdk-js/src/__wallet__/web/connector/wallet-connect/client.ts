import SignClient from "@walletconnect/sign-client";
import { CoreTypes, ProposalTypes, SessionTypes } from "@walletconnect/types";

export class WalletConnectClient {
  private client!: SignClient;
  private pendingApproval: (() => Promise<SessionTypes.Struct>) | null = null;
  private activeRequests: Set<Promise<any>> = new Set();
  private sessionDeleteHandlers: Array<() => void> = [];

  /**
   * Register a callback to run when the WalletConnect session is deleted.
   */
  public onSessionDelete(fn: () => void) {
    this.sessionDeleteHandlers.push(fn);
  }

  /**
   * Initialize the SignClient with your project credentials.
   */
  async init(opts: {
    projectId: string;
    metadata: CoreTypes.Metadata;
    relayUrl?: string;
  }): Promise<void> {
    this.client = await SignClient.init({
      projectId: opts.projectId,
      metadata: opts.metadata,
      ...(opts.relayUrl ? { relayUrl: opts.relayUrl } : {}),
    });

    // Listen for session deletions and notify handlers
    this.client.on("session_delete", () => {
      this.sessionDeleteHandlers.forEach((h) => h());
    });
  }

  /**
   * Kick off a pairing request. Returns the URI for QR/deep link.
   */
  async pair(namespaces: ProposalTypes.OptionalNamespaces): Promise<string> {
    if (this.pendingApproval) {
      throw new Error("WalletConnect: Pairing already in progress");
    }

    const { uri, approval } = await this.client.connect({
      optionalNamespaces: namespaces,
    });

    if (!uri) {
      throw new Error("WalletConnect: no URI returned");
    }

    this.pendingApproval = approval;
    return uri;
  }

  /**
   * Approve the pairing (after the user scans/opens the URI).
   * Resolves to the active session.
   */
  async approve(): Promise<SessionTypes.Struct> {
    if (!this.pendingApproval) {
      throw new Error("WalletConnect: call pair() before approve()");
    }
    try {
      const session = await this.pendingApproval();
      return session;
    } finally {
      this.pendingApproval = null;
    }
  }

  /**
   * Returns the most-recently-approved session, or null if none exist.
   * Always reads directly from SignClient's internal store.
   */
  getSession(): SessionTypes.Struct | null {
    const sessions = this.client.session.getAll();
    return sessions.length ? sessions[sessions.length - 1]! : null;
  }

  /**
   * Send an RPC request over the active session.
   */
  async request(
    chainId: string,
    method: string,
    params: any[] | Record<string, any>,
  ): Promise<any> {
    const session = this.getSession();
    if (!session) {
      throw new Error("WalletConnect: no active session");
    }

    const promise = this.client.request({
      topic: session.topic,
      chainId,
      request: { method, params },
    });

    this.activeRequests.add(promise);
    try {
      return await promise;
    } finally {
      this.activeRequests.delete(promise);
    }
  }

  /**
   * Disconnect the active session (if any), waiting for in-flight requests to settle.
   */
  async disconnect(): Promise<void> {
    const session = this.getSession();
    if (!session) return;

    await Promise.allSettled([...this.activeRequests]);
    await this.client.disconnect({
      topic: session.topic,
      reason: { code: 6000, message: "User disconnected" },
    });
  }
}
