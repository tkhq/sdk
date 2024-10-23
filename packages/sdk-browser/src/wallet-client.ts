import { TurnkeyWalletClientConfig } from './__types__/base';
import { TurnkeyBrowserClient } from './sdk-client';

export { WalletStamper } from '@turnkey/wallet-stamper';

export class TurnkeyWalletClient extends TurnkeyBrowserClient {
  constructor(config: TurnkeyWalletClientConfig) {
    super(config);
  }
}
