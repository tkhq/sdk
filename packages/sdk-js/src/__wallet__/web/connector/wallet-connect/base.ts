import SignClient from "@walletconnect/sign-client";
import { CoreTypes, ProposalTypes, SessionTypes } from "@walletconnect/types";

export class WalletConnectClient {
  private client!: SignClient;
  private session: SessionTypes.Struct | null = null;
  private pendingApproval: (() => Promise<SessionTypes.Struct>) | null = null;
  private activeRequests: Set<Promise<any>> = new Set();
  private sessionDeleteHandlers: Array<() => void> = [];

  public onSessionDelete(fn: () => void) {
    this.sessionDeleteHandlers.push(fn);
  }

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

    // we restore the existing session if it's available
    const sessions = this.client.session.getAll();
    if (sessions.length) {
      this.session = sessions[sessions.length - 1]!;
    }

    // setup session cleanup listener
    this.client.on("session_delete", () => {
      this.session = null;
      this.pendingApproval = null;

      // we notify the parent that the session was deleted
      // so it can update it's local state as well
      this.sessionDeleteHandlers.forEach((h) => h());
    });
  }

  async pair(namespaces: ProposalTypes.OptionalNamespaces): Promise<string> {
    if (this.pendingApproval) {
      throw new Error("WalletConnect: Pairing already in progress");
    }

    const { uri, approval } = await this.client.connect({
      requiredNamespaces: namespaces,
    });

    if (!uri) {
      throw new Error("WalletConnect: no URI");
    }

    this.pendingApproval = approval;
    return uri;
  }

  async approve(): Promise<SessionTypes.Struct> {
    if (!this.pendingApproval) {
      throw new Error("WalletConnect: call pair() before approve()");
    }

    try {
      this.session = await this.pendingApproval();
      return this.session;
    } finally {
      this.pendingApproval = null;
    }
  }

  async request(
    chainId: string,
    method: string,
    params: any[] | Record<string, any>,
  ): Promise<any> {
    if (!this.session) {
      throw new Error("WalletConnect: no active session");
    }

    // we need this because ethereum requests are an array
    // but Solana requests are an object
    const rpcParams = Array.isArray(params) ? params : params;

    // we track active requests
    const requestPromise = this.client.request({
      topic: this.session.topic,
      chainId,
      request: { method, params: rpcParams },
    });

    this.activeRequests.add(requestPromise);

    try {
      return await requestPromise;
    } finally {
      this.activeRequests.delete(requestPromise);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.session) return;

    // we wait for any pending requests to complete
    await Promise.allSettled([...this.activeRequests]);

    try {
      await this.client.disconnect({
        topic: this.session.topic,
        reason: { code: 6000, message: "User disconnected" },
      });
    } finally {
      this.session = null;
      this.pendingApproval = null;
    }
  }

  getSession(): SessionTypes.Struct | null {
    return this.session;
  }
}
