import {
  EIP1193Provider,
  EIP1193RequestFn,
  EIP1474Methods,
  ProviderRpcError,
  RpcRequestError,
  WalletRpcSchema,
  signatureToHex,
} from 'viem';
import { getHttpRpcClient, pad } from 'viem/utils';
import EventEmitter from 'events';
import { preprocessTransaction } from './utils';
import type { TurnkeyEIP1193ProviderOptions } from './types';
import type { definitions } from '@turnkey/http/src/__generated__/services/coordinator/public/v1/public_api.types';
import type {
  TSignRawPayloadResponse,
  TSignTransactionResponse,
} from '@turnkey/http/src/__generated__/services/coordinator/public/v1/public_api.fetcher';

export { createAPIKeyStamper } from './turnkey';

export interface TurnkeyEIP1193Provider extends EIP1193Provider {
  connect: () => void;
}

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

  const request: EIP1193RequestFn<EIP1474Methods> = async ({
    method,
    params,
  }) => {
    try {
      switch (method) {
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
          const activityResponse = await turnkeyClient.signRawPayload({
            type: 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2',
            organizationId,
            parameters: {
              signWith,
              payload: pad(message),
              encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
              hashFunction: 'HASH_FUNCTION_NO_OP',
            },
            timestampMs: String(Date.now()), // millisecond timestamp
          });

          const { signRawPayloadResult: signature } =
            unwrapActivityResult<TSignRawPayloadResponse>(activityResponse, {
              errorMessage: 'Error signing transaction',
            });

          if (!signature) {
            // @todo update error message
            throw 'Error signing transaction';
          }

          return signatureToHex({
            r: `0x${signature.r}`,
            s: `0x${signature.s}`,
            v: BigInt(signature.v) + 27n,
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
          const { signTransactionResult: signedTransaction } =
            unwrapActivityResult<TSignTransactionResponse>(activityResponse, {
              errorMessage: 'Error signing transaction',
            });
          return `0x${signedTransaction}`;
        }

        case 'eth_signTypedData_v4':
          // const [address, message] = params as WalletRpcSchema[8]['Parameters'];
          // Logic to handle eth_signTypedData_v4
          return '0x...'; // Placeholder return

        case 'wallet_addEthereumChain':
          // Brainstorming here:
          // The Turnkey API doesn't have a straight forward notion of `chain`
          // But we can use the addressFormat to determine if we are on:
          // Solana, Cosmos, Ethereum, Bitcoin
          // When adding a chain the steps are outlined as follows:
          // - If the targetChain is the same as the current chain, return
          // - Get the current
          // - If the chain to add is an evm chain then (I think) we don't need to create a
          //   new wallet if the currently connected wallet
          // params:
          /*
            {
              chainId,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: [chain.rpcUrls.default?.http[0] ?? ''],
              ...(blockExplorerUrl
                ? { blockExplorerUrl: [blockExplorerUrl] }
                : {}),
            },
          */
          return null; // Placeholder return

        case 'wallet_getPermissions':
          // Logic to handle wallet_getPermissions
          return []; // Placeholder return

        case 'wallet_requestPermissions':
          // Logic to handle wallet_requestPermissions
          return []; // Placeholder return

        case 'wallet_switchEthereumChain':
          // Logic to handle wallet_switchEthereumChain
          return null; // Placeholder return

        case 'wallet_watchAsset':
          // Logic to handle wallet_watchAsset
          return true; // Placeholder return

        default:
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
    connect: () => {},
  } satisfies TurnkeyEIP1193Provider;
};

function unwrapActivityResult<T extends definitions['v1ActivityResponse']>(
  activityResponse: T,
  { errorMessage }: { errorMessage: string }
): T['activity']['result'] {
  const { activity } = activityResponse;

  switch (activity.status) {
    case 'ACTIVITY_STATUS_CONSENSUS_NEEDED': {
      throw 'Consensus needed';
    }
    case 'ACTIVITY_STATUS_COMPLETED': {
      const result = activity.result;
      if (result === undefined) {
        throw 'Activity result is undefined';
      }
      return result;
    }
    default: {
      throw errorMessage;
    }
  }
}
