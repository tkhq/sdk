import {
  type Address,
  type EIP1193Provider,
  ProviderRpcError,
  RpcRequestError,
  type WalletRpcSchema,
  type TypedDataDefinition,
  type AddEthereumChainParameter,
  Chain,
} from 'viem';
import { getHttpRpcClient, hashTypedData } from 'viem/utils';
import viemChains from 'viem/chains';
import EventEmitter from 'events';
import { preprocessTransaction } from './utils';
import type {
  TurnkeyEIP1193Provider,
  TurnkeyEIP1193ProviderOptions,
} from './types';
import type { TSignTransactionResponse } from '@turnkey/http/src/__generated__/services/coordinator/public/v1/public_api.fetcher';
import { signMessage, unwrapActivityResult } from './turnkey';
import packageJson from '../package.json';

export { createAPIKeyStamper } from './turnkey';

type ProviderChain = Omit<Chain, 'nativeCurrency'> & {
  nativeCurrency?: Chain['nativeCurrency'];
};

let internalChains: Record<string, ProviderChain>[] = [];

/**** NOTES:
 * - Definition of connected:
 *    - the walletId, organizationId of the user is known
 * - Try and pull the walletId, organizationId local storage
 *   - If walletId, organizationId are not found then we need to sign{in|up} the user
 *      -
 *   - If the walletId, organizationId are found then we need to call /public/v1/query/whoami
 *   to ensure that the organizationId aligns with the users
 */
export const createEIP1193Provider = async (
  options: TurnkeyEIP1193ProviderOptions
) => {
  const { turnkeyClient, organizationId, walletId, rpcUrl } = options;

  // Used for public RPC requests
  let id = 0;
  let isConnected = false;
  const eventEmitter = new EventEmitter();

  const setConnected = (connected: boolean) => {
    // Going from a connected state to a disconnected state; emit disconnected
    if (isConnected && !connected) {
      eventEmitter.emit('disconnected');
      // Going from a disconnected state to a connected state; emit connected
    } else if (!isConnected && connected) {
      eventEmitter.emit('connected');
    }
    // Indicates no transition took place so no event is emitted
    isConnected = connected;
  };

  const request: TurnkeyEIP1193Provider['request'] = async ({
    method,
    params,
  }) => {
    try {
      switch (method) {
        case 'web3_clientVersion': {
          return `TurnkeyEIP1193Provider/v${packageJson.version}`;
        }
        /**
         * Requests that the user provide an Ethereum address to be identified by.
         * This method is specified by [EIP-1102](https://eips.ethereum.org/EIPS/eip-1102)
         * @returns {Promise<Address[]>} An array of addresses after user authorization.
         */
        case 'eth_requestAccounts':
        // For now this will return the same response as the `eth_accounts`
        // Later, we could add a way for developers to surface a UI for user to select their accounts

        /**
         * Returns a list of addresses owned by the user.
         * @returns {Promise<Address[]>} An array of addresses owned by the user.
         */
        case 'eth_accounts':
          return await turnkeyClient
            .getWalletAccounts({
              organizationId,
              walletId,
            })
            .then(({ accounts }) => accounts.map(({ address }) => address));

        case 'personal_sign':
        case 'eth_sign': {
          const [signWith, message] =
            params as WalletRpcSchema[6]['Parameters'];

          return await signMessage({
            organizationId,
            message,
            signWith,
            client: turnkeyClient,
          });
        }
        case 'eth_signTransaction': {
          const [transaction] = params as WalletRpcSchema[7]['Parameters'];
          const unsignedTransaction = preprocessTransaction(transaction);
          const activityResponse = await turnkeyClient.signTransaction({
            type: 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2',
            organizationId: organizationId,
            parameters: {
              signWith: transaction.from,
              type: 'TRANSACTION_TYPE_ETHEREUM',
              unsignedTransaction,
            },
            timestampMs: String(Date.now()),
          });
          const { signTransactionResult } =
            unwrapActivityResult<TSignTransactionResponse>(activityResponse, {
              errorMessage: 'Error signing transaction',
            });
          return `0x${signTransactionResult?.signedTransaction}`;
        }

        case 'eth_signTypedData_v4': {
          const [signWith, typedData] = params as [
            Address,
            TypedDataDefinition
          ];

          const message = hashTypedData(typedData);

          return signMessage({
            organizationId,
            message,
            signWith,
            client: turnkeyClient,
          });
        }
        case 'wallet_addEthereumChain': {
          const [chain] = params as [AddEthereumChainParameter];
          const chainId = parseInt(chain.chainId, 16);
          const matchingChain = Object.values(viemChains).find(
            (c) => c.id === chainId
          );
          if (!matchingChain) {
            const newChain: ProviderChain = {
              id: chainId,
              name: chain.chainName,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: { default: chain.rpcUrls[0], http: chain.rpcUrls },
              blockExplorers: chain.blockExplorerUrls
                ? {
                    default: {
                      name: 'Default Explorer',
                      url: chain.blockExplorerUrls[0],
                    },
                  }
                : undefined,
            };
            internalChains.push(newCHain);
          }
          // Ensure the chain ID is a 0x-prefixed hexadecimal string and can be parsed to an integer
          if (
            !/^0x[0-9a-fA-F]+$/.test(chainId) ||
            isNaN(parseInt(chainId, 16))
          ) {
            throw new ProviderRpcError(new Error('Invalid chain ID format'), {
              code: 4903,
              shortMessage: 'Invalid chain ID format',
            });
          }

          // Prevent adding the same chain ID multiple times
          if (addedChains.includes(chainId)) {
            throw new ProviderRpcError(new Error('Chain ID already added'), {
              code: 4904,
              shortMessage: 'Chain ID already added',
            });
          }

          const chainParameters = internalChains[chainId];
          if (!chainParameters) {
            throw new ProviderRpcError(new Error('Chain not supported'), {
              code: 4902,
              shortMessage: 'Chain not supported',
            });
          }

          // Verify the specified chain ID matches the return value of eth_chainId from the endpoint
          const rpcChainId = await getRpcChainId(chainParameters.rpcUrls[0]);
          if (chainId.toLowerCase() !== rpcChainId.toLowerCase()) {
            throw new ProviderRpcError(
              new Error('Chain ID does not match the RPC endpoint'),
              {
                code: 4905,
                shortMessage: 'Chain ID mismatch',
              }
            );
          }

          // Logic to handle adding the Ethereum chain
          // Placeholder for actual implementation
          internalChains.push(chainId); // Track added chain IDs to prevent duplicates
          return chainParameters;
        }
        case 'wallet_switchEthereumChain':
          // Logic to handle wallet_switchEthereumChain
          return null; // Placeholder return

        case 'eth_subscribe':
        case 'eth_unsubscribe':
        case 'eth_blobBaseFee':
        case 'eth_blockNumber':
        case 'eth_call':
        case 'eth_coinbase':
        case 'eth_estimateGas':
        case 'eth_feeHistory':
        case 'eth_gasPrice':
        case 'eth_getBalance':
        case 'eth_getBlockByHash':
        case 'eth_getBlockByNumber':
        case 'eth_getBlockReceipts':
        case 'eth_getBlockTransactionCountByHash':
        case 'eth_getBlockTransactionCountByNumber':
        case 'eth_getCode':
        case 'eth_getFilterChanges':
        case 'eth_getFilterLogs':
        case 'eth_getLogs':
        case 'eth_getProof':
        case 'eth_getStorageAt':
        case 'eth_getTransactionByBlockHashAndIndex':
        case 'eth_getTransactionByBlockNumberAndIndex':
        case 'eth_getTransactionByHash':
        case 'eth_getTransactionCount':
        case 'eth_getTransactionReceipt':
        case 'eth_getUncleCountByBlockHash':
        case 'eth_getUncleCountByBlockNumber':
        case 'eth_maxPriorityFeePerGas':
        case 'eth_newBlockFilter':
        case 'eth_newFilter':
        case 'eth_newPendingTransactionFilter':
        case 'eth_syncing':
        case 'eth_uninstallFilter':
          const rpcClient = getHttpRpcClient(rpcUrl);

          let response = await rpcClient.request({
            body: {
              method,
              params,
              id: id++,
            },
          });
          if (response.error) {
            throw new RpcRequestError({
              body: { method, params },
              error: response.error,
              url: rpcUrl,
            });
          }
          return response.result;
        default:
          throw new ProviderRpcError(new Error('Method not supported'), {
            code: 4200,
            shortMessage: 'Method not supported',
          });
      }
    } catch (error: any) {
      // @todo handle errors related to public provider or turnkey api connectivity
      // Emit disconnected if...
      // - Wrong chain rpc url
      // - Wrong turnkeyclient api url
      // - public provider can't connect for some reason
      //    (although public provider should throw that on it on I think?)

      // @todo make sure this complies with provider errors in all cases
      throw new ProviderRpcError(new Error(error.message), {
        code: error.code,
        shortMessage: error.message,
      });
    }
  };

  // Establishes the connectivity of the provider
  // TODO: Maybe add polling here (make it optional)
  // Poll for blocknumber and balance and cache it
  // request({ method: 'eth_blockNumber' }).then(() => {
  //   setConnected(true);
  // });

  return {
    on: eventEmitter.on,
    removeListener: eventEmitter.removeListener,
    request,
  } satisfies EIP1193Provider;
};
