import SignClient from "@walletconnect/sign-client";
import type {
  CoreTypes,
  ProposalTypes,
  SessionTypes,
} from "@walletconnect/types";

/**
 * WalletConnectClient is a low-level wrapper around the WalletConnect SignClient.
 *
 * - Used internally by `WalletConnectWallet` to manage connections and sessions.
 * - Handles pairing, approval, session tracking, RPC requests, and disconnects.
 * - Exposes a minimal API for lifecycle control; higher-level logic lives in `WalletConnectWallet`.
 */
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
   * - Must be called before `pair()`, `approve()`, or `request()`.
   * - Configures app metadata and an optional custom relay server.
   *
   * @param opts.projectId - WalletConnect project ID.
   * @param opts.appMetadata - Metadata about your app (name, URL, icons).
   * @param opts.relayUrl - (Optional) custom relay server URL.
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
   * - Requires `init()` to have been called.
   * - Must be followed by `approve()` after the wallet approves.
   * - Throws if a pairing is already in progress.
   *
   * @param namespaces - Optional namespaces requesting capabilities.
   * @returns A WalletConnect URI for the wallet to connect with.
   * @throws {Error} If a pairing is already in progress or no URI is returned.
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
   * - Requires `init()` and a pending pairing started via `pair()`.
   *
   * @returns A promise that resolves to the established session.
   * @throws {Error} If called before `pair()` or if approval fails.
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
   * - Requires `init()` and an active session.
   *
   * @param chainId - Target chain ID (e.g. `eip155:1`).
   * @param method - RPC method name.
   * @param params - Parameters for the RPC method.
   * @returns A promise that resolves with the RPC response.
   * @throws {Error} If no active session exists.
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
