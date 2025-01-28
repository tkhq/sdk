import type { TurnkeyClient } from "@turnkey/http";
import type { UUID } from "crypto";
import type {
  AddEthereumChainParameter,
  Address,
  Chain,
  EIP1193Provider,
  EIP1193RequestFn,
  EIP1474Methods,
  Hash,
  TypedDataDefinition,
} from "viem";

export type TurnkeyEIP1193ProviderOptions = {
  walletId: UUID;
  organizationId: UUID;
  turnkeyClient: TurnkeyClient;
  chains: AddEthereumChainParameter[];
};

export type TurnkeyEIP1193Provider = Omit<EIP1193Provider, "request"> & {
  request: EIP1193RequestFn<
    [
      ...EIP1474Methods,
      {
        Method: "eth_signTypedData_v4";
        Parameters: [address: Address, typedData: TypedDataDefinition];
        ReturnType: Promise<Hash>;
      }
    ]
  >;
};

export type ProviderChain = Omit<Chain, "nativeCurrency"> & {
  nativeCurrency?: Chain["nativeCurrency"] | undefined;
};

export type HTTPSUrl = `https://${string}`;

export type WalletAddEthereumChain = Omit<
  AddEthereumChainParameter,
  "rpcUrls" | "blockExplorerUrls"
> & {
  rpcUrls: [string, ...string[]];
  blockExplorerUrls: [HTTPSUrl, ...HTTPSUrl[]] | null;
};

export interface ConnectInfo {
  chainId: string;
}
