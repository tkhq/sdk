import { ChainNotConfiguredError, createConnector } from '@wagmi/core';
import {
  createEIP1193Provider,
  type TurnkeyEIP1193Provider,
} from '@turnkey/eip-1193-provider';
import type { UUID } from 'node:crypto';
import {
  ProviderRpcError,
  SwitchChainError,
  UserRejectedRequestError,
  getAddress,
  numberToHex,
} from 'viem';

interface TurnkeyAuthModalProps {
  onComplete: (walletId: UUID) => void;
  onError: (error: Error) => void;
}

type TurnkeyAuthCallback = (
  options: TurnkeyAuthModalProps
) => React.JSX.Element;

export type TurnkeyConnectorParameters = {
  rpcUrl: string;
  walletId: UUID;
  appId: UUID;
  // @todo: Maybe this could default to window.location.href?
  rpId?: string;

  baseUrl?: string;

  chainId?: number;
  onTurnkeyAuth: TurnkeyAuthCallback;
};

// Do we need an option for an apikey stamper as well?
// If so maybe it would make sense to pass in the stamper directly instead of the options?
// or add sub options where if they are defined the connector knows which stamper to use
// Example:
// { webAuthnStamper: { rpId }, apiKeyStamper: { apiPublicKey, apiPrivateKey } }

turnkey.type = 'turnkey' as const;

export function turnkey({
  rpcUrl,
  appId,
  baseUrl = 'https://api.turnkey.com',
  // @todo: Maybe this could default to window.location.href?
  rpId = 'localhost',
  chainId,
  onTurnkeyAuth,
}: TurnkeyConnectorParameters) {
  let turnkeyProvider: TurnkeyEIP1193Provider;

  type Properties = {};

  return createConnector<TurnkeyEIP1193Provider, Properties>((config) => ({
    id: 'turnkey',
    name: 'Turnkey',
    type: turnkey.type,
    async connect({ chainId } = {}) {
      const provider = (await this.getProvider()) as TurnkeyEIP1193Provider;
      // Initial call here will authenticate the user and connect the wallet
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      });

      provider.on('accountsChanged', this.onAccountsChanged);
      provider.on('chainChanged', this.onChainChanged);
      provider.on('disconnect', this.onDisconnect.bind(this));

      // Switch to chain if provided
      let currentChainId = await this.getChainId();
      if (chainId && currentChainId !== chainId) {
        const chain = await this.switchChain!({ chainId }).catch((error) => {
          if (error.code === UserRejectedRequestError.code) throw error;
          return { id: currentChainId };
        });
        currentChainId = chain?.id ?? currentChainId;
      }

      return {
        accounts: accounts ? accounts : ['0x'],
        chainId: currentChainId,
      };
    },
    async getProvider(): Promise<TurnkeyEIP1193Provider> {
      if (!turnkeyProvider) {
        // TODO: use the chains from the wagmi provided config object
        const chain = config.chains.find((chain) =>
          chainId ? chain.id === chainId : config.chains[0]
        );

        const jsonRpcUrl = rpcUrl ?? chain?.rpcUrls.default.http[0];

        // TODO: We could try and get the wallet id from the local storage and if so we can auto connect
        let walletId = '';

        // Call the onTurnkeyConnect
        // const walletId = await renderTurnkeyAuth(onTurnkeyAuth);

        // TODO: add chainId to the provider options?
        turnkeyProvider = await createEIP1193Provider(jsonRpcUrl, {
          appId: appId,
          rpId: 'localhost',
          baseUrl,
        });
      }
      return turnkeyProvider;
    },
    async disconnect() {
      const provider = await this.getProvider();

      provider.removeListener('accountsChanged', this.onAccountsChanged);
      provider.removeListener('chainChanged', this.onChainChanged);
      provider.removeListener('disconnect', this.onDisconnect.bind(this));
      // TODO: any other clean up logic
    },
    async getAccounts() {
      const provider = await this.getProvider();
      return (
        await provider.request({
          method: 'eth_accounts',
        })
      ).map((x) => getAddress(x));
    },
    async getChainId() {
      const provider = (await this.getProvider()) as TurnkeyEIP1193Provider;
      const chainId = await provider.request({ method: 'eth_chainId' });
      return parseInt(chainId, 16);
    },
    async switchChain({ chainId: targetChainId }) {
      const chain = config.chains.find((x) => x.id === targetChainId);
      if (!chain) throw new SwitchChainError(new ChainNotConfiguredError());

      const provider = (await this.getProvider()) as TurnkeyEIP1193Provider;
      const chainId = numberToHex(chain.id);

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId }],
        });
        return chain;
      } catch (error) {
        // Indicates chain is not added to provider
        if ((error as ProviderRpcError).code === 4902) {
          try {
            const blockExplorerUrl = chain.blockExplorers?.default.url;
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId,
                  chainName: chain.name,
                  nativeCurrency: chain.nativeCurrency,
                  rpcUrls: [chain.rpcUrls.default?.http[0] ?? ''],
                  ...(blockExplorerUrl
                    ? { blockExplorerUrl: [blockExplorerUrl] }
                    : {}),
                },
              ],
            });
            return chain;
          } catch (error) {
            throw new UserRejectedRequestError(error as Error);
          }
        }
        throw new SwitchChainError(error as Error);
      }
    },
    // If `true` wagmi will attempt to reconnect calling the connect function
    isAuthorized: async () => false,
    onAccountsChanged: () => {},
    onChainChanged: () => {},
    onConnect: () => {},
    onDisconnect: () => {},
    onMessage: () => {},
  }));
}
