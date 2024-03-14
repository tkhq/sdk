import type { TurnkeyClient } from '@turnkey/http';
import type { UUID } from 'crypto';

export type TurnkeyEIP1193ProviderOptions = {
  rpcUrl: string;
  walletId: UUID;
  organizationId: UUID;
  chainId?: number;
  turnkeyClient: TurnkeyClient;
};
