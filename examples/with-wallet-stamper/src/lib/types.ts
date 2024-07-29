import { type TurnkeyClient } from '@turnkey/http';

export type Attestation = Parameters<
  TurnkeyClient['createSubOrganization']
>[0]['parameters']['rootUsers'][0]['authenticators'][0]['attestation'];

export interface PassKeyRegistrationResult {
  challenge: string;
  attestation: Attestation;
}

export enum ChainType {
  EVM = 'evm',
  SOLANA = 'solana',
}
