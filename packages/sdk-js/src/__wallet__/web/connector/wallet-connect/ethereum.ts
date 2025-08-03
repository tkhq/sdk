import { recoverPublicKey, hashMessage, type Hex } from "viem";
import { compressRawPublicKey } from "@turnkey/crypto";
import {
  WalletType,
  WalletRpcProvider,
  WalletProvider,
  WalletProviderInfo,
  SignIntent,
  WalletConnectProvider,
  EthereumWalletConnectInterface,
} from "@types";
import { WalletConnectClient } from "./base";

export class WalletConnectEthereumWallet
  implements EthereumWalletConnectInterface
{
  readonly type = WalletType.EthereumWalletConnect;
  private address?: string | undefined;
  private uri?: string;

  constructor(private client: WalletConnectClient) {
    // we subscribe to the session deletions
    // notification that the client emits
    this.client.onSessionDelete(() => {
      this.address = undefined;
    });
  }

  async init(): Promise<void> {
    const session = this.client.getSession();

    if (session?.namespaces.eip155?.accounts?.[0]) {
      this.address = session.namespaces.eip155.accounts[0].split(":")[2];
    }

    this.uri = await this.client.pair({
      eip155: {
        methods: ["personal_sign", "eth_sendTransaction"],
        chains: ["eip155:1"],
        events: ["accountsChanged", "chainChanged"],
      },
    });
  }

  async getProviders(): Promise<WalletProvider[]> {
    if (!this.uri) {
      throw new Error("WalletConnectEthereumWallet not initialized");
    }

    const info: WalletProviderInfo = {
      name: "WalletConnect",
      icon: "https://walletconnect.com/_next/static/media/logo_mark.84dd8525.svg",
    };
    const base = {
      type: this.type,
      info,
      provider: this.makeProvider(),
      connectedAddresses: this.address ? [this.address] : [],
      uri: this.uri,
    };
    return [base];
  }

  async connectWalletAccount(_provider: WalletRpcProvider): Promise<void> {
    const session = await this.client.approve();
    if (!session) throw new Error("No active WalletConnect session");

    const eip155Namespace = session.namespaces.eip155;
    if (
      !eip155Namespace ||
      !eip155Namespace.accounts ||
      eip155Namespace.accounts.length === 0
    ) {
      throw new Error("No eip155 accounts found in session");
    }
    const acc = eip155Namespace.accounts[0];
    if (!acc) {
      throw new Error("No account found in eip155 namespace");
    }
    this.address = acc.split(":")[2];
  }

  async sign(
    message: string,
    provider: WalletRpcProvider,
    intent: SignIntent,
  ): Promise<string> {
    // we ensure the wallet is connected before signing
    // if its not we will be stuck here until the user connects
    if (!this.address) {
      await this.connectWalletAccount(provider);
    }

    switch (intent) {
      case SignIntent.SignMessage:
        return (await this.client.request("eip155:1", "personal_sign", [
          message as Hex,
          this.address,
        ])) as string;
      case SignIntent.SignAndSendTransaction:
        const txParams = JSON.parse(message);
        return (await this.client.request("eip155:1", "eth_sendTransaction", [
          txParams,
        ])) as string;
      default:
        throw new Error(`Unsupported intent: ${intent}`);
    }
  }

  async getPublicKey(): Promise<string> {
    if (!this.address) throw new Error("Not connected");
    const sig = (await this.client.request("eip155:1", "personal_sign", [
      "GET_PUBLIC_KEY",
      this.address,
    ])) as string;
    const raw = await recoverPublicKey({
      hash: hashMessage("GET_PUBLIC_KEY"),
      signature: sig as Hex,
    });
    const buf = Buffer.from(raw.slice(2), "hex");
    return Buffer.from(compressRawPublicKey(buf)).toString("hex");
  }

  async disconnectWalletAccount(_provider: WalletRpcProvider): Promise<void> {
    await this.client.disconnect();
    this.address = undefined;

    // we create a new URI for the next connection
    // we do this in the background because this is kind of slow
    // and we don't want to block the UI
    this.client
      .pair({
        eip155: {
          methods: ["personal_sign", "eth_sendTransaction"],
          chains: ["eip155:1"],
          events: ["accountsChanged", "chainChanged"],
        },
      })
      .then((newUri) => {
        this.uri = newUri;
      });
  }

  private makeProvider(): WalletConnectProvider {
    return {
      request: async ({ method, params }: any) =>
        this.client.request("eip155:1", method, params ?? []),
    };
  }
}
