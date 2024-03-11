import type { UUID } from 'crypto';

export interface TurnkeyAuthModalProps {
  onComplete: (organizationId: UUID, walletId: UUID) => void;
  onError: (error: Error) => void;
}

export type TurnkeyAuthCallback = (
  options: TurnkeyAuthModalProps
) => React.JSX.Element;

export type TurnkeyConnectorParameters = {
  rpcUrl: string;
  walletId: UUID;
  organizationId: UUID;
  // @todo: Maybe this could default to window.location.href?
  rpId?: string;

  baseUrl?: string;

  chainId?: number;
  onTurnkeyAuth: TurnkeyAuthCallback;
};
