import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
  stringToBase64urlString,
} from "@turnkey/encoding";
import bs58 from "bs58";
import { recoverPublicKey, hashMessage, type Hex } from "viem";
import { compressRawPublicKey } from "@turnkey/crypto";
import {
  Chain,
  WalletInterfaceType,
  WalletProvider,
  WalletProviderInfo,
  SignIntent,
  WalletConnectProvider,
  WalletConnectInterface,
} from "@types";
import { WalletConnectClient } from "./client";
import { SessionTypes } from "@walletconnect/types";

const EVM_CHAIN = "eip155:1";
const SOLANA_CHAIN = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

export class WalletConnectWallet implements WalletConnectInterface {
  readonly interfaceType = WalletInterfaceType.WalletConnect;

  private enabledChains: { ethereum?: boolean; solana?: boolean } = {};
  private uri?: string;

  constructor(private client: WalletConnectClient) {
    this.client.onSessionDelete(() => {});
  }

  async init(opts?: { ethereum?: boolean; solana?: boolean }): Promise<void> {
    console.log("Initializing WalletConnect...");
    console.log("Enabled chains:", opts);
    this.enabledChains = {
      ethereum: opts?.ethereum ?? false,
      solana: opts?.solana ?? false,
    };

    if (!this.enabledChains.ethereum && !this.enabledChains.solana) {
      throw new Error("At least one chain must be enabled for WalletConnect");
    }

    const session = this.client.getSession();
    if (hasConnectedAccounts(session)) {
      return;
    }

    const namespaces: Record<string, any> = {};

    if (opts?.ethereum === true) {
      console.log("Enabling Ethereum namespace for WalletConnect");
      namespaces.eip155 = {
        methods: ["personal_sign", "eth_sendTransaction"],
        chains: [EVM_CHAIN],
        events: ["accountsChanged", "chainChanged"],
      };
    }

    if (opts?.solana === true) {
      console.log("Enabling Solana namespace for WalletConnect");
      namespaces.solana = {
        methods: [
          "solana_signMessage",
          "solana_signTransaction",
          "solana_sendTransaction",
        ],
        chains: [SOLANA_CHAIN],
        events: ["accountsChanged", "chainChanged"],
      };
    }

    this.uri = await this.client.pair(namespaces);
  }

  async getProviders(): Promise<WalletProvider[]> {
    const session = this.client.getSession();

    const info: WalletProviderInfo = {
      name: "WalletConnect",
      icon: "https://walletconnect.com/_next/static/media/logo_mark.84dd8525.svg",
    };

    const chains = [
      {
        namespace: "eip155",
        chainId: EVM_CHAIN,
        chain: Chain.Ethereum,
        interfaceType: WalletInterfaceType.WalletConnect,
      },
      {
        namespace: "solana",
        chainId: SOLANA_CHAIN,
        chain: Chain.Solana,
        interfaceType: WalletInterfaceType.WalletConnect,
      },
    ];

    return chains
      .map(({ namespace, chainId, chain, interfaceType }) => {
        const account = session?.namespaces[namespace]?.accounts?.[0];
        const address = account?.split(":")[2];

        return {
          interfaceType,
          chain,
          info,
          provider: this.makeProvider(chainId),
          connectedAddresses: address ? [address] : [],
          uri: this.uri,
        };
      })
      .filter(Boolean) as WalletProvider[];
  }

  async connectWalletAccount(_provider: WalletProvider): Promise<void> {
    const session = await this.client.approve();
    const acc = getConnectedEthereum(session) || getConnectedSolana(session);
    if (!acc) throw new Error("No account found in session");
  }

  async sign(
    message: string,
    provider: WalletProvider,
    intent: SignIntent,
  ): Promise<string> {
    const session = this.client.getSession();
    if (!session) {
      throw new Error("WalletConnectWallet.sign: no active session");
    }

    if (provider.chain === Chain.Ethereum) {
      const address = getConnectedEthereum(session);
      if (!address) {
        throw new Error("no Ethereum account to sign with");
      }

      switch (intent) {
        case SignIntent.SignMessage:
          return (await this.client.request(EVM_CHAIN, "personal_sign", [
            message as Hex,
            address,
          ])) as string;
        case SignIntent.SignAndSendTransaction:
          return (await this.client.request(EVM_CHAIN, "eth_sendTransaction", [
            JSON.parse(message),
          ])) as string;
        default:
          throw new Error(`Unsupported Ethereum intent: ${intent}`);
      }
    }

    if (provider.chain === Chain.Solana) {
      const address = getConnectedSolana(session);
      if (!address) {
        throw new Error("no Solana account to sign with");
      }

      switch (intent) {
        case SignIntent.SignMessage: {
          const msgBytes = new TextEncoder().encode(message);
          const msgB58 = bs58.encode(msgBytes);
          const { signature: sigB58 } = await this.client.request(
            SOLANA_CHAIN,
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
            SOLANA_CHAIN,
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
            SOLANA_CHAIN,
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

  async getPublicKey(provider: WalletProvider): Promise<string> {
    const session = this.client.getSession();

    if (provider.chain === Chain.Ethereum) {
      const address = getConnectedEthereum(session);
      if (!address) {
        throw new Error("No Ethereum account to retrieve public key");
      }

      const sig = await this.client.request(EVM_CHAIN, "personal_sign", [
        "GET_PUBLIC_KEY",
        address,
      ]);
      const raw = await recoverPublicKey({
        hash: hashMessage("GET_PUBLIC_KEY"),
        signature: sig as Hex,
      });
      return Buffer.from(
        compressRawPublicKey(Buffer.from(raw.slice(2), "hex")),
      ).toString("hex");
    }

    if (provider.chain === Chain.Solana) {
      const address = getConnectedSolana(session);
      if (!address) {
        throw new Error("No Solana account to retrieve public key");
      }

      const publicKeyBytes = bs58.decode(address);
      return uint8ArrayToHexString(publicKeyBytes);
    }

    throw new Error("No supported namespace for public key retrieval");
  }

  async disconnectWalletAccount(_provider: WalletProvider): Promise<void> {
    await this.client.disconnect();

    const namespaces: Record<string, any> = {};

    if (this.enabledChains.ethereum) {
      namespaces.eip155 = {
        methods: ["personal_sign", "eth_sendTransaction"],
        chains: [EVM_CHAIN],
        events: ["accountsChanged", "chainChanged"],
      };
    }

    if (this.enabledChains.solana) {
      namespaces.solana = {
        methods: [
          "solana_signMessage",
          "solana_signTransaction",
          "solana_sendTransaction",
        ],
        chains: [SOLANA_CHAIN],
        events: ["accountsChanged", "chainChanged"],
      };
    }

    await this.client.pair(namespaces).then((newUri) => {
      this.uri = newUri;
    });
    console.log("New WalletConnect URI:", this.uri);
  }

  private makeProvider(chainId: string): WalletConnectProvider {
    return {
      request: ({ method, params }: any) => {
        return this.client.request(chainId, method, params);
      },
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
