import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
  stringToBase64urlString,
} from "@turnkey/encoding";
import bs58 from "bs58";
import { recoverPublicKey, hashMessage, type Hex, toHex } from "viem";
import { compressRawPublicKey } from "@turnkey/crypto";
import {
  Chain,
  WalletInterfaceType,
  WalletProvider,
  WalletProviderInfo,
  SignIntent,
  WalletConnectProvider,
  WalletConnectInterface,
  SwitchableChain,
} from "@types";
import type { WalletConnectClient } from "./client";
import type { SessionTypes } from "@walletconnect/types";
import { Transaction } from "ethers";

export class WalletConnectWallet implements WalletConnectInterface {
  readonly interfaceType = WalletInterfaceType.WalletConnect;

  private ethereumNamespaces: string[] = [];
  private solanaNamespaces: string[] = [];

  private ethChain!: string;
  private solChain!: string;

  private uri?: string;

  constructor(private client: WalletConnectClient) {
    this.client.onSessionDelete(() => {});
  }

  /**
   * Initializes WalletConnect pairing flow with the specified chains.
   * If an active session already exists, pairing is skipped.
   *
   * @param opts.ethereum - Whether to enable Ethereum pairing
   * @param opts.solana - Whether to enable Solana pairing
   * @throws {Error} If no chains are enabled
   */
  async init(opts: {
    ethereumNamespaces: string[];
    solanaNamespaces: string[];
  }): Promise<void> {
    this.ethereumNamespaces = opts.ethereumNamespaces;
    if (this.ethereumNamespaces.length > 0) {
      this.ethChain = this.ethereumNamespaces[0]!;
    }

    this.solanaNamespaces = opts.solanaNamespaces;
    if (this.solanaNamespaces.length > 0) {
      this.solChain = this.solanaNamespaces[0]!;
    }

    if (
      this.ethereumNamespaces.length === 0 &&
      this.solanaNamespaces.length === 0
    ) {
      throw new Error(
        "At least one namespace must be enabled for WalletConnect",
      );
    }

    const session = this.client.getSession();
    if (hasConnectedAccounts(session)) {
      return;
    }

    const namespaces: Record<string, any> = {};

    if (this.ethereumNamespaces.length > 0) {
      namespaces.eip155 = {
        methods: [
          "personal_sign",
          "eth_sendTransaction",
          "eth_chainId",
          "wallet_switchEthereumChain",
          "wallet_addEthereumChain",
        ],
        chains: this.ethereumNamespaces,
        events: ["accountsChanged", "chainChanged"],
      };
    }

    if (this.solanaNamespaces.length > 0) {
      namespaces.solana = {
        methods: [
          "solana_signMessage",
          "solana_signTransaction",
          "solana_sendTransaction",
        ],
        chains: this.solanaNamespaces,
        events: ["accountsChanged", "chainChanged"],
      };
    }

    this.uri = await this.client.pair(namespaces);
  }

  /**
   * Returns WalletConnect providers with associated chain/account metadata.
   */
  async getProviders(): Promise<WalletProvider[]> {
    const session = this.client.getSession();

    const info: WalletProviderInfo = {
      name: "WalletConnect",
      icon: "https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/refs/heads/master/Icon/Blue%20(Default)/Icon.svg",
    };

    const providers: WalletProvider[] = [];

    if (this.ethereumNamespaces.length > 0) {
      providers.push(await this.buildEthProvider(session, info));
    }

    if (this.solanaNamespaces.length > 0) {
      providers.push(this.buildSolProvider(session, info));
    }

    return providers;
  }

  /**
   * Approves the session if needed and ensures at least one account is available.
   */
  async connectWalletAccount(_provider: WalletProvider): Promise<void> {
    const session = await this.client.approve();
    if (!hasConnectedAccounts(session))
      throw new Error("No account found in session");
  }

  /**
   * Switch the user’s WalletConnect session to a new EVM chain.
   *
   * @param provider   – the WalletProvider returned by getProviders()
   * @param chainOrId  – either:
   *                     • a CAIP string ("eip155:1", "eip155:137", …)
   *                     • a SwitchableChain object carrying full metadata
   */
  async switchChain(
    provider: WalletProvider,
    chainOrId: string | SwitchableChain,
  ): Promise<void> {
    if (provider.chainInfo.namespace !== Chain.Ethereum) {
      throw new Error("Only EVM wallets support chain switching");
    }

    const session = this.client.getSession();
    if (!session) {
      throw new Error("No active WalletConnect session");
    }

    const hexChainId = typeof chainOrId === "string" ? chainOrId : chainOrId.id;
    const caip = `eip155:${Number.parseInt(hexChainId, 16)}`;

    if (!this.ethereumNamespaces.includes(caip)) {
      throw new Error(
        `Unsupported chain ${caip}. Supported chains: ${this.ethereumNamespaces.join(
          ", ",
        )}. If you’d like to support ${caip}, add it to the \`ethereumNamespaces\` in your WalletConnect config.`,
      );
    }

    try {
      // first we just try switching
      await this.client.request(this.ethChain, "wallet_switchEthereumChain", [
        { chainId: hexChainId },
      ]);

      this.ethChain = caip;
    } catch (err: any) {
      throw new Error(
        `Failed to switch chain: ${err.message || err.toString()}`,
      );
    }
  }

  /**
   * Signs a message or transaction using the specified provider and intent.
   *
   * @param message - The message or serialized transaction to sign.
   * @param provider - The WalletProvider to use.
   * @param intent - The type of signing intent (message, tx, send).
   */
  async sign(
    message: string,
    provider: WalletProvider,
    intent: SignIntent,
  ): Promise<string> {
    const session = await this.ensureSession();

    if (!hasConnectedAccounts(session)) {
      await this.connectWalletAccount(provider);
    }

    if (provider.chainInfo.namespace === Chain.Ethereum) {
      const address = getConnectedEthereum(session);
      if (!address) {
        throw new Error("no Ethereum account to sign with");
      }

      switch (intent) {
        case SignIntent.SignMessage:
          return (await this.client.request(this.ethChain, "personal_sign", [
            message as Hex,
            address,
          ])) as string;
        case SignIntent.SignAndSendTransaction:
          const account = provider.connectedAddresses[0];
          const tx = Transaction.from(message);
          const txParams = {
            from: account,
            to: tx.to?.toString() as Hex,
            value: toHex(tx.value),
            gas: toHex(tx.gasLimit),
            maxFeePerGas: toHex(tx.maxFeePerGas ?? 0n),
            maxPriorityFeePerGas: toHex(tx.maxPriorityFeePerGas ?? 0n),
            nonce: toHex(tx.nonce),
            chainId: toHex(tx.chainId),
            data: (tx.data?.toString() as Hex) ?? "0x",
          };

          return (await this.client.request(
            this.ethChain,
            "eth_sendTransaction",
            [txParams],
          )) as string;
        default:
          throw new Error(`Unsupported Ethereum intent: ${intent}`);
      }
    }

    if (provider.chainInfo.namespace === Chain.Solana) {
      const address = getConnectedSolana(session);
      if (!address) {
        throw new Error("no Solana account to sign with");
      }

      switch (intent) {
        case SignIntent.SignMessage: {
          const msgBytes = new TextEncoder().encode(message);
          const msgB58 = bs58.encode(msgBytes);
          const { signature: sigB58 } = await this.client.request(
            this.solChain,
            "solana_signMessage",
            {
              pubkey: address,
              message: msgB58,
            },
          );
          return uint8ArrayToHexString(bs58.decode(sigB58));
        }
        case SignIntent.SignTransaction: {
          const txBytes = uint8ArrayFromHexString(message);
          const txBase64 = stringToBase64urlString(
            String.fromCharCode(...txBytes),
          );
          const { signature: sigB58 } = await this.client.request(
            this.solChain,
            "solana_signTransaction",
            {
              feePayer: address,
              transaction: txBase64,
            },
          );
          return uint8ArrayToHexString(bs58.decode(sigB58));
        }
        case SignIntent.SignAndSendTransaction: {
          const txBytes = uint8ArrayFromHexString(message);
          const txBase64 = stringToBase64urlString(
            String.fromCharCode(...txBytes),
          );
          const sigB58 = await this.client.request(
            this.solChain,
            "solana_sendTransaction",
            {
              feePayer: address,
              transaction: txBase64,
              options: { skipPreflight: false },
            },
          );
          return uint8ArrayToHexString(bs58.decode(sigB58));
        }
        default:
          throw new Error(`Unsupported Solana intent: ${intent}`);
      }
    }

    throw new Error("No supported namespace available for signing");
  }

  /**
   * Retrieves the public key of the connected wallet.
   *
   * @param provider - The WalletProvider to fetch the key from.
   * @returns Compressed public key as a hex string.
   */
  async getPublicKey(provider: WalletProvider): Promise<string> {
    const session = this.client.getSession();

    if (provider.chainInfo.namespace === Chain.Ethereum) {
      const address = getConnectedEthereum(session);
      if (!address) {
        throw new Error("No Ethereum account to retrieve public key");
      }

      const sig = await this.client.request(this.ethChain, "personal_sign", [
        "GET_PUBLIC_KEY",
        address,
      ]);
      const rawPublicKey = await recoverPublicKey({
        hash: hashMessage("GET_PUBLIC_KEY"),
        signature: sig as Hex,
      });

      const publicKeyHex = rawPublicKey.startsWith("0x")
        ? rawPublicKey.slice(2)
        : rawPublicKey;

      const publicKeyBytes = uint8ArrayFromHexString(publicKeyHex);
      const publicKeyBytesCompressed = compressRawPublicKey(publicKeyBytes);

      return uint8ArrayToHexString(publicKeyBytesCompressed);
    }

    if (provider.chainInfo.namespace === Chain.Solana) {
      const address = getConnectedSolana(session);
      if (!address) {
        throw new Error("No Solana account to retrieve public key");
      }

      const publicKeyBytes = bs58.decode(address);
      return uint8ArrayToHexString(publicKeyBytes);
    }

    throw new Error("No supported namespace for public key retrieval");
  }

  /**
   * Disconnects the current session and re-initiates a fresh pairing URI.
   */
  async disconnectWalletAccount(_provider: WalletProvider): Promise<void> {
    await this.client.disconnect();

    const namespaces: Record<string, any> = {};

    if (this.ethereumNamespaces.length > 0) {
      namespaces.eip155 = {
        methods: [
          "personal_sign",
          "eth_sendTransaction",
          "eth_chainId",
          "wallet_switchEthereumChain",
          "wallet_addEthereumChain",
        ],
        chains: this.ethereumNamespaces,
        events: ["accountsChanged", "chainChanged"],
      };
    }

    if (this.solanaNamespaces.length > 0) {
      namespaces.solana = {
        methods: [
          "solana_signMessage",
          "solana_signTransaction",
          "solana_sendTransaction",
        ],
        chains: this.solanaNamespaces,
        events: ["accountsChanged", "chainChanged"],
      };
    }

    await this.client.pair(namespaces).then((newUri) => {
      this.uri = newUri;
    });
  }

  /**
   * Builds a lightweight provider interface for the given chain.
   *
   * @param chainId - The namespace chain ID (e.g., eip155:1)
   * @returns A WalletConnect-compatible provider implementation
   */
  private makeProvider(chainId: string): WalletConnectProvider {
    return {
      request: ({ method, params }: any) => {
        return this.client.request(chainId, method, params);
      },
    };
  }

  /**
   * Ensures there is an active WalletConnect session, initiating approval if necessary.
   *
   * @returns The current WalletConnect session
   * @throws {Error} If approval fails or session is not established
   */
  private async ensureSession(): Promise<SessionTypes.Struct> {
    let session = this.client.getSession();
    if (!session) {
      await this.client.approve();
      session = this.client.getSession();
      if (!session) throw new Error("WalletConnect: approval failed");
    }
    return session;
  }

  /**
   * Builds a WalletProvider descriptor for an EVM chain.
   */
  private async buildEthProvider(
    session: SessionTypes.Struct | null,
    info: WalletProviderInfo,
  ): Promise<WalletProvider> {
    const raw = session?.namespaces.eip155?.accounts?.[0] ?? "";
    const address = raw.split(":")[2];

    const chainIdString = this.ethChain.split(":")[1] ?? "1";
    const chainIdDecimal = Number(chainIdString);
    const chainidHex = `0x${chainIdDecimal.toString(16)}`;

    return {
      interfaceType: WalletInterfaceType.WalletConnect,
      chainInfo: {
        namespace: Chain.Ethereum,
        chainId: chainidHex,
      },
      info,
      provider: this.makeProvider(this.ethChain),
      connectedAddresses: address ? [address] : [],
      ...(this.uri && { uri: this.uri }),
    };
  }

  /**
   * Builds a WalletProvider descriptor for Solana.
   */
  private buildSolProvider(
    session: SessionTypes.Struct | null,
    info: WalletProviderInfo,
  ): WalletProvider {
    const raw = session?.namespaces.solana?.accounts?.[0] ?? "";
    const address = raw.split(":")[2];

    return {
      interfaceType: WalletInterfaceType.WalletConnect,
      chainInfo: { namespace: Chain.Solana },
      info,
      provider: this.makeProvider(this.solChain),
      connectedAddresses: address ? [address] : [],
      ...(this.uri && { uri: this.uri }),
    };
  }
}

function hasConnectedAccounts(session: SessionTypes.Struct | null): boolean {
  return (
    !!session &&
    Object.values(session.namespaces).some((ns) => ns.accounts?.length > 0)
  );
}

function getConnectedEthereum(
  session: SessionTypes.Struct | null,
): string | undefined {
  const acc = session?.namespaces.eip155?.accounts?.[0];
  return acc ? acc.split(":")[2] : undefined;
}

function getConnectedSolana(
  session: SessionTypes.Struct | null,
): string | undefined {
  const acc = session?.namespaces.solana?.accounts?.[0];
  return acc ? acc.split(":")[2] : undefined;
}
