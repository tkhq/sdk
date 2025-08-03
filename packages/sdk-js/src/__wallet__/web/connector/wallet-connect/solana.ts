import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
  stringToBase64urlString,
} from "@turnkey/encoding";
import bs58 from "bs58";
import {
  SignIntent,
  SolanaWalletConnectInterface,
  WalletProvider,
  WalletProviderInfo,
  WalletRpcProvider,
  WalletType,
  WalletConnectProvider,
} from "@types";
import { WalletConnectClient } from "./base";

const SOLANA_CHAIN = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

export class WalletConnectSolanaWallet implements SolanaWalletConnectInterface {
  readonly type = WalletType.SolanaWalletConnect;
  private address?: string | undefined;
  private uri?: string;

  constructor(private client: WalletConnectClient) {
    this.client.onSessionDelete(() => {
      this.address = undefined;
    });
  }

  async init(): Promise<void> {
    const session = this.client.getSession();
    if (session?.namespaces.solana?.accounts?.[0]) {
      this.address = session.namespaces.solana.accounts[0].split(":")[2];
    }

    this.uri = await this.client.pair({
      solana: {
        methods: [
          "solana_signMessage",
          "solana_signTransaction",
          "solana_sendTransaction",
        ],
        chains: [SOLANA_CHAIN],
        events: ["accountsChanged", "chainChanged"],
      },
    });
  }

  async getProviders(): Promise<WalletProvider[]> {
    if (!this.uri) {
      throw new Error("WalletConnectSolanaWallet not initialized");
    }

    const info: WalletProviderInfo = {
      name: "WalletConnect",
      icon: "https://walletconnect.com/_next/static/media/logo_mark.84dd8525.svg",
    };

    return [
      {
        type: this.type,
        info,
        provider: this.makeProvider(),
        connectedAddresses: this.address ? [this.address] : [],
        uri: this.uri,
      },
    ];
  }

  async connectWalletAccount(_provider: WalletRpcProvider): Promise<void> {
    const session = await this.client.approve();
    if (!session) throw new Error("No active WalletConnect session");

    const solanaNamespace = session.namespaces.solana;
    if (!solanaNamespace?.accounts?.[0]) {
      throw new Error("No Solana accounts found in session");
    }

    this.address = solanaNamespace.accounts[0].split(":")[2];
  }

  async sign(
    message: string,
    provider: WalletRpcProvider,
    intent: SignIntent,
  ): Promise<string> {
    if (!this.address) {
      await this.connectWalletAccount(provider);
    }

    switch (intent) {
      case SignIntent.SignMessage: {
        const msgBytes = new TextEncoder().encode(message);
        const msgB58 = bs58.encode(msgBytes);

        const { signature: sigB58 } = await this.client.request(
          SOLANA_CHAIN,
          "solana_signMessage",
          { pubkey: this.address, message: msgB58 },
        );

        const sigBytes = bs58.decode(sigB58);
        return uint8ArrayToHexString(sigBytes);
      }

      case SignIntent.SignTransaction: {
        const txBytes = uint8ArrayFromHexString(message);
        const txBase64 = stringToBase64urlString(
          String.fromCharCode(...txBytes),
        );

        const { signature: sigB58 } = await this.client.request(
          SOLANA_CHAIN,
          "solana_signTransaction",
          { feePayer: this.address, transaction: txBase64 },
        );

        const sigBytes = bs58.decode(sigB58);
        return uint8ArrayToHexString(sigBytes);
      }

      case SignIntent.SignAndSendTransaction: {
        const txBytes = uint8ArrayFromHexString(message);
        const txBase64 = stringToBase64urlString(
          String.fromCharCode(...txBytes),
        );

        const sigB58 = await this.client.request(
          SOLANA_CHAIN,
          "solana_sendTransaction",
          {
            feePayer: this.address,
            transaction: txBase64,
            options: { skipPreflight: false },
          },
        );

        const sigBytes = bs58.decode(sigB58);
        return uint8ArrayToHexString(sigBytes);
      }

      default:
        throw new Error(`Unsupported sign intent: ${intent}`);
    }
  }

  async getPublicKey(_provider: WalletRpcProvider): Promise<string> {
    if (!this.address) throw new Error("Not connected");
    const publicKeyBytes = bs58.decode(this.address);
    return uint8ArrayToHexString(publicKeyBytes);
  }

  async disconnectWalletAccount(_provider: WalletRpcProvider): Promise<void> {
    await this.client.disconnect();
    this.address = undefined;

    this.client
      .pair({
        solana: {
          methods: [
            "solana_signMessage",
            "solana_signTransaction",
            "solana_sendTransaction",
          ],
          chains: [SOLANA_CHAIN],
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
        this.client.request(SOLANA_CHAIN, method, params ?? []),
    };
  }
}
