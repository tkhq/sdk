import type { UUID } from 'node:crypto';
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
import { preprocessTransaction, renderTurnkeyAuth } from './utils';
import type { TurnkeyAuthCallback } from './types';
import type { TurnkeyClient } from '@turnkey/http';
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
  rpcUrl: string,
  options: {
    // WalletId is an option in case developers want to store walletId in local storage and
    // initiate the provider with a previously connected wallet
    // does not mean that the current user has access to that wallet however, they
    // will still need to be authenticated
    walletId?: UUID;
    onTurnkeyAuth?: TurnkeyAuthCallback;
    // The org id of the application or parent (used to call /whoami)
    appId: UUID;
    // The id of the subOrg of the user who's wallet this provider manages
    subOrgId?: UUID;
    rpId?: string;
    baseUrl?: string;
    // Optional, if not passed in then internal client will be used
    turnkeyClient?: TurnkeyClient;
  }
) => {
  const { rpId, baseUrl, appId, onTurnkeyAuth } = options;
  let id = 0;
  let isConnected = false;
  const eventEmitter = new EventEmitter();

  let organizationId = '';
  let walletId = '';

  const { TurnkeyClient } = await import('@turnkey/http');
  const { WebauthnStamper } = await import('@turnkey/webauthn-stamper');

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: baseUrl || 'https://api.turnkey.com' },
    // Note this may need to be configurable in the
    // future to allow for apiKeyStamper
    new WebauthnStamper({
      rpId: rpId || window.location.href,
    })
  );

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
    let result;
    let error: { code: number; message: string } | undefined;

    // We we don't have a walletId & organizationId defined then we need to get
    // it from the user so call renderTurnkeyAuth
    // if (!(organizationId || walletId) && onTurnkeyAuth) {
    //   ({ organizationId, walletId } = await renderTurnkeyAuth(onTurnkeyAuth));
    // }

    // If we don't have a connected wallet then we must authenticate and connect a wallet to the provider
    if (!walletId) {
      // Obtain the suborg id of the user
      // This call will fail if the user's authentication creds are in valid
      // OR if the user is not apart of the organization
      ({ organizationId } = await turnkeyClient.getWhoami({
        organizationId: appId,
      }));

      // Get the wallets associated with the user's suborg
      const { wallets } = await turnkeyClient.getWallets({
        organizationId,
      });

      // If there is at least 1 wallet, set it as the primary connected wallet
      if (wallets[0]) {
        ({ walletId } = wallets[0]);
      }

      // If error 4100 Unauthorized
      // console.log(whoAmI);
    }

    switch (method) {
      /**
       * Requests that the user provide an Ethereum address to be identified by.
       * This method is specified by [EIP-1102](https://eips.ethereum.org/EIPS/eip-1102)
       * Note: For now
       * @returns {Promise<Address[]>} An array of addresses after user authorization.
       */
      case 'eth_requestAccounts':
      // For now this will return the same response as the `eth_accounts`
      // Later, we'll add a way for developers to surface a UI for user to select their accounts

      /**
       * Returns a list of addresses owned by the user.
       * @returns {Promise<Address[]>} An array of addresses owned by the user.
       */
      case 'eth_accounts':
        await turnkeyClient
          .getWalletAccounts({
            organizationId,
            walletId,
          })
          .then(({ accounts }) => {
            result = accounts.map(({ address }) => address);
          })
          //@todo break this out into a different function
          .catch((err) => {
            // This indicates that we are disconnected from the
            // "provider" which in this case is Turnkey
            // We then set the provider error code to 4900 (disconnected)
            // per the provider errors spec -> https://eips.ethereum.org/EIPS/eip-1193#provider-errors
            if (err.code === 'ENOTFOUND') {
              err.code = 4900;
            }

            error = {
              code: err.code,
              message: err.message,
            };
          });
        break;

      case 'personal_sign':
      case 'eth_sign':
        try {
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

          if (
            activityResponse.activity.status === 'ACTIVITY_STATUS_COMPLETED'
          ) {
            const signature =
              activityResponse.activity?.result?.signRawPayloadResult;
            if (signature) {
              result = signatureToHex({
                r: `0x${signature.r}`,
                s: `0x${signature.s}`,
                v: BigInt(signature.v) + 27n,
              });
            }
          }
        } catch (err) {
          throw new Error('Error processing signature'); // Or handle the error as you see fit
        }
        break;
      case 'eth_signTransaction':
        const [transaction] = params as WalletRpcSchema[7]['Parameters'];
        const unsignedTransaction = preprocessTransaction(transaction);
        await turnkeyClient
          .signTransaction({
            type: 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2',
            organizationId: organizationId,
            parameters: {
              signWith: transaction.from,
              type: 'TRANSACTION_TYPE_ETHEREUM',
              unsignedTransaction,
            },
            timestampMs: String(Date.now()), // millisecond timestamp
          })
          .then(({ activity }) => {
            if (activity.status === 'ACTIVITY_STATUS_COMPLETED') {
              if (activity?.result?.signTransactionResult?.signedTransaction) {
                result = `0x${activity?.result?.signTransactionResult?.signedTransaction}`;
              }
            }
          });

        break;
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
        result = response.result;
    }
    if (error) {
      if (error?.code === 4900) {
        setConnected(false);
      }
      throw new ProviderRpcError(new Error(error.message), {
        code: error.code,
        shortMessage: error.message,
      });
    }
    return result;
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
