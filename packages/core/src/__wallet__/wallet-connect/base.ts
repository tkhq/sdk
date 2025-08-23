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

type WalletConnectChangeEvent =
  | { type: "disconnect" }
  | { type: "chainChanged"; chainId?: string }
  | { type: "update" };

export class WalletConnectWallet implements WalletConnectInterface {
  readonly interfaceType = WalletInterfaceType.WalletConnect;

  private ethereumNamespaces: string[] = [];
  private solanaNamespaces: string[] = [];

  private ethChain!: string;
  private solChain!: string;

  private uri?: string;

  private changeListeners = new Set<
    (event?: WalletConnectChangeEvent) => void
  >();

  private addChangeListener(
    listener: (event?: WalletConnectChangeEvent) => void,
  ) {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notifyChange(event?: WalletConnectChangeEvent) {
    this.changeListeners.forEach((listener) => listener(event));
  }

  /**
   * Constructs a WalletConnectWallet bound to a WalletConnect client.
   *
   * - Subscribes to session deletions and automatically re-initiates pairing,
   *   updating `this.uri` so the UI can present a fresh QR/deeplink.
   *
   * @param client - The low-level WalletConnect client used for session/RPC.
   */
  constructor(private client: WalletConnectClient) {
    // session disconnected
    this.client.onSessionDelete(() => {
      this.notifyChange({ type: "disconnect" });
    });

    // session updated (actual update to the session for example adding a chain to namespaces)
    this.client.onSessionUpdate(() => {
      this.notifyChange({ type: "update" });
    });

    // chain switched
    this.client.onSessionEvent(({ event }: any) => {
      if (event?.name === "chainChanged" || event?.name === "accountsChanged") {
        const chainId =
          typeof event.data?.chainId === "string"
            ? event.data.chainId
            : undefined;
        this.notifyChange({ type: "chainChanged", chainId });
      }
    });
  }

  /**
   * Initializes WalletConnect pairing flow with the specified namespaces.
   *
   * - Saves the requested chain namespaces (e.g., `["eip155:1", "eip155:137", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"]`).
   * - If an active session already has connected accounts, pairing is skipped.
   * - Otherwise initiates a pairing and stores the resulting URI.
   *
   * @param opts.ethereumNamespaces - List of EVM CAIP IDs (e.g., "eip155:1").
   * @param opts.solanaNamespaces - List of Solana CAIP IDs (e.g., "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp").
   * @throws {Error} If no namespaces are provided for either chain.
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

    // we don't want to create more than one active session
    // so we don't make a pair request if one is already active
    // since pairing would mean initializing a new session
    const session = this.client.getSession();
    if (hasConnectedAccounts(session)) {
      return;
    }

    const namespaces = this.buildNamespaces();

    this.uri = await this.client.pair(namespaces);
  }

  /**
   * Returns WalletConnect providers with associated chain/account metadata.
   *
   * - Builds an EVM provider (if Ethereum namespaces are enabled).
   * - Builds a Solana provider (if Solana namespaces are enabled).
   *
   * @returns A promise resolving to an array of WalletProvider objects.
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
   *
   * - Calls `approve()` on the underlying client when pairing is pending.
   * - Throws if the approved session contains no connected accounts.
   *
   * @param _provider - Unused (present for interface compatibility).
   * @throws {Error} If the session contains no accounts.
   */
  async connectWalletAccount(_provider: WalletProvider): Promise<void> {
    const session = await this.client.approve();
    if (!hasConnectedAccounts(session))
      throw new Error("No account found in session");
  }

  /**
   * Switches the user’s WalletConnect session to a new EVM chain.
   *
   * - Ethereum-only: only supported for providers on the Ethereum namespace.
   * - No add-then-switch: WalletConnect cannot add chains mid-session. The target chain
   *   must be present in `ethereumNamespaces` negotiated at pairing time. To support a new chain,
   *   you must include it in the walletConfig.
   * - Accepts a hex chain ID (e.g., "0x1"). If a `SwitchableChain` is passed, only its `id`
   *   (hex chain ID) is used; metadata is ignored for WalletConnect.
   *
   * @param provider - The WalletProvider returned by `getProviders()`.
   * @param chainOrId - Hex chain ID (e.g., "0x1") or a `SwitchableChain` (its `id` is used).
   * @returns A promise that resolves when the switch completes.
   * @throws {Error} If no active session, provider is non-EVM, the chain is not in `ethereumNamespaces`,
   *                 or the switch RPC fails.
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
   * Signs a message or transaction using the specified wallet provider and intent.
   *
   * - Ensures an active WalletConnect session:
   *   - If a pairing is in progress (URI shown but not yet approved), this call will
   *     wait for the user to approve the session and may appear stuck until they do.
   *   - If no pairing is in progress, this will throw (e.g., "call pair() before approve()").
   * - Ethereum:
   *   - `SignMessage` → `personal_sign` (returns hex signature).
   *   - `SignAndSendTransaction` → `eth_sendTransaction` (returns tx hash).
   * - Solana:
   *   - `SignMessage` → `solana_signMessage` (returns hex signature).
   *   - `SignTransaction` → `solana_signTransaction` (returns hex signature).
   *   - `SignAndSendTransaction` → `solana_sendTransaction` (returns hex signature of the submitted tx).
   *
   * @param payload - Payload or serialized transaction to sign.
   * @param provider - The WalletProvider to use.
   * @param intent - The signing intent.
   * @returns A hex string (signature or transaction hash, depending on intent).
   * @throws {Error} If no account is available, no pairing is in progress, or the intent is unsupported.
   */
  async sign(
    payload: string,
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
            payload as Hex,
            address,
          ])) as string;
        case SignIntent.SignAndSendTransaction:
          const account = provider.connectedAddresses[0];
          const tx = Transaction.from(payload);
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
          const msgBytes = new TextEncoder().encode(payload);
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
          const txBytes = uint8ArrayFromHexString(payload);
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
          const txBytes = uint8ArrayFromHexString(payload);
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
   * - Ethereum: signs a fixed challenge and recovers the compressed secp256k1 public key.
   * - Solana: decodes the base58-encoded address to raw bytes.
   *
   * @param provider - The WalletProvider to fetch the key from.
   * @returns A compressed public key as a hex string.
   * @throws {Error} If no account is available or the namespace is unsupported.
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
   *
   * - Calls `disconnect()` on the client, then `pair()` with current namespaces.
   * - Updates `this.uri` so the UI can present a new QR/deeplink.
   */
  async disconnectWalletAccount(_provider: WalletProvider): Promise<void> {
    await this.client.disconnect();

    const namespaces = this.buildNamespaces();

    await this.client.pair(namespaces).then((newUri) => {
      this.uri = newUri;
    });
  }

  /**
   * Builds a lightweight provider interface for the given chain.
   *
   * @param chainId - Namespace chain ID (e.g., "eip155:1" or "solana:101").
   * @returns A WalletConnect-compatible provider that proxies JSON-RPC via WC.
   */
  private makeProvider(chainId: string): WalletConnectProvider {
    return {
      request: ({ method, params }: any) =>
        this.client.request(chainId, method, params),
      features: {
        "standard:events": {
          on: (event: string, callback: (evt: any) => void) => {
            if (event !== "change") return () => {};
            return this.addChangeListener(callback);
          },
        },
      },
    };
  }

  /**
   * Ensures there is an active WalletConnect session, initiating approval if necessary.
   *
   * - If a session exists, returns it immediately.
   * - If no session exists but a pairing is in progress, awaits `approve()` —
   *   this will block until the user approves (or rejects) in their wallet.
   * - If no session exists and no pairing is in progress, throws; the caller
   *   must have initiated pairing via `pair()` elsewhere.
   *
   * @returns The active WalletConnect session.
   * @throws {Error} If approval is rejected, completes without establishing a session,
   *                 or no pairing is in progress.
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
   *
   * - Extracts the connected address (if any) and current chain ID.
   * - Includes the pairing `uri` if available.
   *
   * @param session - Current WalletConnect session (or null).
   * @param info - Provider branding info (name, icon).
   * @returns A WalletProvider object for Ethereum.
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
   *
   * - Extracts the connected address (if any).
   * - Includes the fresh pairing `uri` if available.
   *
   * @param session - Current WalletConnect session (or null).
   * @param info - Provider branding info (name, icon).
   * @returns A WalletProvider object for Solana.
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

  /**
   * Builds the requested WalletConnect namespaces from the current config.
   *
   * - Includes methods and events for Ethereum and/or Solana based on enabled namespaces.
   *
   * @returns A namespaces object suitable for `WalletConnectClient.pair()`.
   */
  private buildNamespaces(): Record<string, any> {
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

    return namespaces;
  }
}

/**
 * Determines whether the session has at least one connected account
 * across any namespace.
 *
 * - Safe to call with `null` (returns `false`).
 * - Checks all namespaces for a non-empty `accounts` array.
 *
 * @param session - The current WalletConnect session, or `null`.
 * @returns `true` if any namespace has ≥1 account; otherwise `false`.
 */
function hasConnectedAccounts(session: SessionTypes.Struct | null): boolean {
  return (
    !!session &&
    Object.values(session.namespaces).some((ns) => ns.accounts?.length > 0)
  );
}

/**
 * Retrieves the first connected Ethereum account.
 *
 * - Safe to call with `null` (returns `undefined`).
 * - Returns only the address portion (e.g., `0xabc...`), not the full CAIP string.
 *
 * @param session - The current WalletConnect session, or `null`.
 * @returns The connected EVM address, or `undefined` if none.
 */
function getConnectedEthereum(
  session: SessionTypes.Struct | null,
): string | undefined {
  const acc = session?.namespaces.eip155?.accounts?.[0];
  return acc ? acc.split(":")[2] : undefined;
}

/**
 * Retrieves the first connected Solana account.
 *
 * - Safe to call with `null` (returns `undefined`).
 * - Returns only the base58 address portion, not the full CAIP string.
 *
 * @param session - The current WalletConnect session, or `null`.
 * @returns The connected Solana address (base58), or `undefined` if none.
 */
function getConnectedSolana(
  session: SessionTypes.Struct | null,
): string | undefined {
  const acc = session?.namespaces.solana?.accounts?.[0];
  return acc ? acc.split(":")[2] : undefined;
}
