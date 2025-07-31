// base.ts
import SignClient from "@walletconnect/sign-client";
import { CoreTypes, ProposalTypes, SessionTypes } from "@walletconnect/types";

export class WalletConnectAdapter {
  private client!: SignClient;
  private session?: SessionTypes.Struct | undefined;
  private pendingApproval?: (() => Promise<SessionTypes.Struct>) | undefined;
  private uri?: string | undefined;

  async init(opts: {
    projectId: string;
    metadata: CoreTypes.Metadata;
    relayUrl?: string;
  }): Promise<void> {
    const initOpts: {
      projectId: string;
      metadata: CoreTypes.Metadata;
      relayUrl?: string;
    } = {
      projectId: opts.projectId,
      metadata: opts.metadata,
      ...(opts.relayUrl ? { relayUrl: opts.relayUrl } : {}),
    };
    this.client = await SignClient.init(initOpts);

    const sessions = this.client.session.getAll();
    if (sessions.length) {
      this.session = sessions[sessions.length - 1];
      this.uri = undefined; // already approved
    }
  }

  async pair(namespaces: ProposalTypes.OptionalNamespaces): Promise<string> {
    const { uri, approval } = await this.client.connect({
      optionalNamespaces: namespaces,
    });
    if (!uri) throw new Error("WalletConnect: no URI");
    this.uri = uri;
    this.pendingApproval = approval;
    return uri;
  }

  async approve(): Promise<SessionTypes.Struct> {
    if (!this.pendingApproval) {
      throw new Error("WalletConnect: call pair() before approve()");
    }
    this.session = await this.pendingApproval();
    this.pendingApproval = undefined;
    return this.session;
  }

  async request(chainId: string, method: string, params: any[]): Promise<any> {
    if (!this.session) throw new Error("WalletConnect: no active session");
    return this.client.request({
      topic: this.session.topic,
      chainId,
      request: { method, params },
    });
  }

  async disconnect(): Promise<void> {
    if (!this.session) throw new Error("WalletConnect: no active session");
    await this.client.disconnect({
      topic: this.session.topic,
      reason: { code: 6000, message: "User disconnected" },
    });
    this.session = undefined;
    this.uri = undefined;
  }

  getSession(): SessionTypes.Struct | undefined {
    return this.session;
  }

  getUrl(): string | undefined {
    return this.uri;
  }
}
