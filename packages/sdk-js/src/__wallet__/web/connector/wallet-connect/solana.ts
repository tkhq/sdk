import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
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
import { CoreTypes } from "@walletconnect/types";
import { WalletConnectClient } from "./base";

export class WalletConnectSolanaWallet implements SolanaWalletConnectInterface {
  readonly type = WalletType.SolanaWalletConnect;
  private client = new WalletConnectClient();
  private address?: string | undefined;
  private uri?: string;

  constructor(
    private cfg: {
      projectId: string;
      metadata: CoreTypes.Metadata;
      relayUrl?: string;
    },
  ) {
    // we subscribe to the session deletions
    // notification that the client emits
    this.client.onSessionDelete(() => {
      this.address = undefined;
    });
  }

  async init(): Promise<void> {
    await this.client.init(this.cfg);
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
        chains: ["solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ"],
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
    if (
      !solanaNamespace ||
      !solanaNamespace.accounts ||
      solanaNamespace.accounts.length === 0
    ) {
      throw new Error("No Solana accounts found in session");
    }

    const acc = solanaNamespace.accounts[0];
    if (!acc) {
      throw new Error("No account found in solana namespace");
    }

    this.address = acc.split(":")[2];
  }

  /**
   * Signs messages or transactions based on intent.
   *
   * @param message - The message or transaction to sign
   * @param provider - Wallet provider
   * @param intent - Signing intent (message, transaction, or send)
   * @returns Promise resolving to signature hex string
   */
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

    const chainId = "solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ";

    switch (intent) {
      case SignIntent.SignMessage: {
        // Convert message to Uint8Array
        const encoder = new TextEncoder();
        const messageBytes = encoder.encode(message);

        // Request signature
        const { signature } = await this.client.request(
          chainId,
          "solana_signMessage",
          [
            {
              pubkey: this.address,
              message: messageBytes,
            },
          ],
        );

        return uint8ArrayToHexString(signature);
      }

      case SignIntent.SignTransaction: {
        // Convert hex transaction to Uint8Array
        const transaction = uint8ArrayFromHexString(message);

        // Request transaction signature
        const { signature } = await this.client.request(
          chainId,
          "solana_signTransaction",
          [
            {
              feePayer: this.address,
              transaction,
            },
          ],
        );

        return uint8ArrayToHexString(signature);
      }

      case SignIntent.SignAndSendTransaction: {
        // Convert hex transaction to Uint8Array
        const transaction = uint8ArrayFromHexString(message);

        // Send transaction and get signature
        const signature = (await this.client.request(
          chainId,
          "solana_sendTransaction",
          [
            {
              feePayer: this.address,
              transaction,
              options: { skipPreflight: false },
            },
          ],
        )) as string;

        // Convert base58 signature to hex
        return uint8ArrayToHexString(bs58.decode(signature));
      }

      default:
        throw new Error(`Unsupported sign intent: ${intent}`);
    }
  }

  /**
   * Retrieves the public key of the connected account.
   *
   * @param _provider - Wallet provider (unused)
   * @returns Promise resolving to hex-encoded public key
   */
  async getPublicKey(_provider: WalletRpcProvider): Promise<string> {
    if (!this.address) throw new Error("Not connected");
    // Convert base58 address to public key bytes
    const publicKeyBytes = bs58.decode(this.address);
    return uint8ArrayToHexString(publicKeyBytes);
  }

  /**
   * Disconnects the wallet account and resets connection state.
   * Generates a new connection URI for future sessions.
   *
   * @param _provider - Wallet provider
   */
  async disconnectWalletAccount(_provider: WalletRpcProvider): Promise<void> {
    await this.client.disconnect();
    this.address = undefined;

    // Generate new URI for next session
    this.client
      .pair({
        solana: {
          methods: [
            "solana_signMessage",
            "solana_signTransaction",
            "solana_sendTransaction",
          ],
          chains: ["solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ"],
          events: ["accountsChanged", "chainChanged"],
        },
      })
      .then((newUri) => {
        this.uri = newUri;
      });
  }

  /**
   * Creates a WalletConnect provider instance.
   *
   * @returns WalletConnect provider object
   */
  private makeProvider(): WalletConnectProvider {
    return {
      request: async ({ method, params }: any) =>
        this.client.request(
          "solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ",
          method,
          params ?? [],
        ),
    };
  }
}
