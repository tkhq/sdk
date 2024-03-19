import type { TurnkeyClient } from '@turnkey/http';
import type { UUID } from 'crypto';
import type {
  Address,
  EIP1193Provider,
  EIP1193RequestFn,
  EIP1474Methods,
  Hash,
  TypedDataDefinition,
} from 'viem';

export type TurnkeyEIP1193ProviderOptions = {
  rpcUrl: string;
  walletId: UUID;
  organizationId: UUID;
  chainId?: number;
  turnkeyClient: TurnkeyClient;
};

export type TurnkeyEIP1193Provider = Omit<EIP1193Provider, 'request'> & {
  request: EIP1193RequestFn<
    [
      ...EIP1474Methods,
      {
        Method: 'eth_signTypedData_v4';
        Parameters: [address: Address, typedData: TypedDataDefinition];
        ReturnType: Promise<Hash>;
      }
    ]
  >;
};
