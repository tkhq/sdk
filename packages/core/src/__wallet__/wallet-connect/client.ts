import SignClient from "@walletconnect/sign-client";
import type {
  CoreTypes,
  ProposalTypes,
  SessionTypes,
} from "@walletconnect/types";

export class WalletConnectClient {
  private client!: SignClient;

  // tracks the pending approval callback returned from `connect()`
  private pendingApproval: (() => Promise<SessionTypes.Struct>) | null = null;

  // callbacks to run when the session is deleted
  private sessionDeleteHandlers: Array<() => void> = [];

  /**
   * Registers a callback that runs when the WalletConnect session is deleted.
   *
   * - Useful for clearing UI state or internal session data.
   *
   * @param fn - A callback function to invoke when the session is deleted.
   */
  public onSessionDelete(fn: () => void) {
    this.sessionDeleteHandlers.push(fn);
  }

  /**
   * Initializes the WalletConnect SignClient with your project credentials.
   *
   * - Must be called before calling `pair()` or `request()`.
   * - Configures metadata and optionally a custom relay server.
   *
   * @param opts.projectId - WalletConnect project ID.
   * @param opts.metadata - Metadata about your app (name, URL, icons).
   * @param opts.relayUrl - (Optional) Custom relay server URL.
   * @returns A promise that resolves once the client is initialized.
   */
  async init(opts: {
    projectId: string;
    appMetadata: CoreTypes.Metadata;
    relayUrl?: string;
  }): Promise<void> {
    this.client = await SignClient.init({
      projectId: opts.projectId,
      metadata: opts.appMetadata,
      ...(opts.relayUrl ? { relayUrl: opts.relayUrl } : {}),
    });

    // we listen for session deletion events and notify subscribers
    this.client.on("session_delete", () => {
      this.sessionDeleteHandlers.forEach((h) => h());
    });
  }

  /**
   * Initiates a pairing request and returns a URI to be scanned or deep-linked.
   *
   * - Must be followed by a call to `approve()` to complete the pairing.
   * - Throws if a pairing is already in progress.
   *
   * @param namespaces - Namespaces to request for optional capabilities.
   * @returns A WalletConnect URI for the wallet to connect with.
   * @throws {Error} If a pairing is already in progress or URI is not returned.
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
   * Completes the pairing approval process after the wallet approves the request.
   *
   * - Must be called after `pair()` and after the wallet has scanned and approved the URI.
   *
   * @returns A promise that resolves to the established session.
   * @throws {Error} If called before `pair()` or approval fails.
   */
  async approve(): Promise<SessionTypes.Struct> {
    if (!this.pendingApproval) {
      throw new Error("WalletConnect: call pair() before approve()");
    }

    try {
      const session = await this.pendingApproval();
      return session;
    } finally {
      // we clear the pending state regardless of outcome
      this.pendingApproval = null;
    }
  }

  /**
   * Retrieves the most recent active WalletConnect session.
   *
   * @returns The most recent session, or `null` if none are active.
   */
  getSession(): SessionTypes.Struct | null {
    const sessions = this.client.session.getAll();
    return sessions.length ? sessions[sessions.length - 1]! : null;
  }

  /**
   * Sends a JSON-RPC request over the active WalletConnect session.
   *
   * - The session must already be connected.
   *
   * @param chainId - Chain ID of the target blockchain (e.g. `eip155:1`).
   * @param method - The RPC method name to call.
   * @param params - The parameters to pass into the RPC method.
   * @returns A promise that resolves with the RPC response.
   * @throws {Error} If no active session is found.
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

    return this.client.request({
      topic: session.topic,
      chainId,
      request: { method, params },
    });
  }

  /**
   * Disconnects the active session, if one exists.
   *
   * - Sends a disconnect signal to the wallet.
   * - Does nothing if no session is currently active.
   *
   * @returns A promise that resolves once disconnection is complete.
   */
  async disconnect(): Promise<void> {
    const session = this.getSession();
    if (!session) return;

    await this.client.disconnect({
      topic: session.topic,
      reason: { code: 6000, message: "User disconnected" },
    });
  }
}
