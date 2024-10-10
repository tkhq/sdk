import {
  type Address,
  type EIP1193Provider,
  ProviderRpcError,
  RpcRequestError,
  type WalletRpcSchema,
  type TypedDataDefinition,
  type AddEthereumChainParameter,
  MethodNotSupportedRpcError,
  ProviderDisconnectedError,
  ChainDisconnectedError,
  Hex,
} from "viem";
import { getAddress, getHttpRpcClient, hashTypedData } from "viem/utils";

import EventEmitter from "events";
import { preprocessTransaction, validateChain } from "./utils";
import type {
  ConnectInfo,
  TurnkeyEIP1193Provider,
  TurnkeyEIP1193ProviderOptions,
} from "./types";
import type { TSignTransactionResponse } from "@turnkey/http/src/__generated__/services/coordinator/public/v1/public_api.fetcher";
import {
  signMessage,
  turnkeyIsDisconnected,
  unwrapActivityResult,
} from "./turnkey";

import { TurnkeyRequestError } from "@turnkey/http";
import { ChainIdMismatchError, UnrecognizedChainError } from "./errors";
import { VERSION } from "./version";

export { TurnkeyEIP1193Provider };

export const createEIP1193Provider = async (
  options: TurnkeyEIP1193ProviderOptions
) => {
  const { turnkeyClient, organizationId, walletId, chains } = options;

  // Used for public RPC requests
  let id = 0;

  // `activeChain` holds the current Ethereum chain that the provider is operating on to.
  // It is set when the provider successfully switches to a new chain via `wallet_switchEthereumChain`
  // or adds a new chain with `wallet_addEthereumChain`. This variable is crucial for ensuring that
  // the provider operates with the correct chain context, including chain ID and RPC URLs.
  let activeChain: AddEthereumChainParameter;

  let addedChains: (AddEthereumChainParameter & { connected: boolean })[] = [];

  const accounts: Set<Address> = new Set();

  // Initialize eventEmitter with a Proxy directly
  const eventEmitter = new EventEmitter();

  // `isInitialized` indicates that the provider is setup and ready to use.
  // Used to skip setting connected for the initial RPC requests.
  let isInitialized = false;

  let lastEmittedEvent: "connect" | "disconnect";
  function setConnected(connected: true, data: ConnectInfo): void;
  function setConnected(connected: false, data: ProviderRpcError): void;
  function setConnected(
    connected: boolean,
    data: ConnectInfo | ProviderRpcError
  ) {
    if (!isInitialized) return;

    // Find the currently selected chain and update its connected status
    addedChains = addedChains.map((chain) =>
      chain.chainId === activeChain.chainId ? { ...chain, connected } : chain
    );
    if (connected && lastEmittedEvent !== "connect" && isInitialized) {
      // Emit 'connect' event when the provider becomes connected as per EIP-1193
      // See https://eips.ethereum.org/EIPS/eip-1193#connect
      eventEmitter.emit("connect", data);
      lastEmittedEvent = "connect";
    } else if (
      addedChains.every(({ connected }) => !connected) &&
      lastEmittedEvent !== "disconnect"
    ) {
      // Emit 'disconnect' event when disconnected from all chains
      // See https://eips.ethereum.org/EIPS/eip-1193#disconnect
      const providerDisconnectedError = new ProviderDisconnectedError(
        data as ProviderRpcError
      );
      eventEmitter.emit("disconnect", providerDisconnectedError);
      // Reset 'connect' emitted flag on disconnect
      lastEmittedEvent = "disconnect";
      throw providerDisconnectedError;
    } else if (!connected) {
      // Provider is disconnected from currentChain but connected to at least 1 other chain
      // Provider is still considered 'connected' & we don't emit unless all chains disconnected
      // See https://eips.ethereum.org/EIPS/eip-1193#provider-errors
      throw new ChainDisconnectedError(data as ProviderRpcError);
    }
  }

  const request: TurnkeyEIP1193Provider["request"] = async ({
    method,
    params,
  }) => {
    try {
      switch (method) {
        case "web3_clientVersion": {
          return VERSION;
        }

        /**
         * Requests that the user provide an Ethereum address to be identified by.
         * This method is specified by [EIP-1102](https://eips.ethereum.org/EIPS/eip-1102)
         * This method must be called first to establish the connectivity of the client.
         * @returns {Promise<Address[]>} An array of addresses after user authorization.
         */
        case "eth_requestAccounts": {
          // Note: In the future we should add a way for developers to surface a UI
          // for user to select their accounts. For now it just returns all accounts
          // for the provided walletId
          const walletAccounts = await turnkeyClient.getWalletAccounts({
            organizationId,
            walletId,
          });
          walletAccounts.accounts.map(({ address }) => {
            accounts.add(address as Address);
          });
          setConnected(true, { chainId: activeChain.chainId });
          return [...accounts];
        }

        /**
         * Returns a list of addresses owned by the user.
         * @returns {Promise<Address[]>} An array of addresses owned by the user.
         */
        case "eth_accounts":
          setConnected(true, { chainId: activeChain.chainId });
          return [...accounts];
        case "personal_sign": {
          const [message, signWith] =
            params as WalletRpcSchema[10]["Parameters"];

          const signedMessage = await signMessage({
            organizationId,
            message,
            signWith,
            client: turnkeyClient,
          });
          setConnected(true, { chainId: activeChain.chainId });
          return signedMessage;
        }
        case "eth_sign": {
          const [signWith, message] =
            params as WalletRpcSchema[6]["Parameters"];

          const signedMessage = await signMessage({
            organizationId,
            message,
            signWith,
            client: turnkeyClient,
          });
          setConnected(true, { chainId: activeChain.chainId });
          return signedMessage;
        }
        case "eth_signTypedData_v4": {
          const [signWith, typedData] = params as [
            Address,
            TypedDataDefinition
          ];

          const message = hashTypedData(typedData);
          const signedMessage = signMessage({
            organizationId,
            message,
            signWith,
            client: turnkeyClient,
          });
          setConnected(true, { chainId: activeChain.chainId });
          return signedMessage;
        }
        case "eth_signTransaction": {
          const [transaction] = params as WalletRpcSchema[7]["Parameters"];
          const unsignedTransaction = preprocessTransaction({ ...transaction });
          const activityResponse = await turnkeyClient.signTransaction({
            type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
            organizationId: organizationId,
            parameters: {
              signWith: getAddress(transaction.from),
              type: "TRANSACTION_TYPE_ETHEREUM",
              unsignedTransaction,
            },
            timestampMs: String(Date.now()),
          });
          const { signTransactionResult } =
            unwrapActivityResult<TSignTransactionResponse>(activityResponse, {
              errorMessage: "Error signing transaction",
            });
          setConnected(true, { chainId: activeChain.chainId });
          return `0x${signTransactionResult?.signedTransaction}`;
        }
        case "wallet_addEthereumChain": {
          const [chain] = params as [AddEthereumChainParameter];

          // Validate the to be added
          validateChain(chain, addedChains);

          // Store the current connected chain for potential rollback
          const previousActiveChain = activeChain;

          // Update the connected chain to the new chain
          activeChain = chain;

          // Verify the specified chain ID matches the return value of eth_chainId from the endpoint
          const rpcChainId = await request({ method: "eth_chainId" });

          if (activeChain.chainId !== rpcChainId) {
            // Revert to the previous connected chain or to undefined if no other chain connected
            activeChain = previousActiveChain;
            throw new ChainIdMismatchError(chain.chainId as Hex, rpcChainId);
          }

          addedChains.push({ ...chain, connected: true });

          return null;
        }

        case "wallet_switchEthereumChain": {
          const [targetChainId] = params as [string];
          const targetChain = addedChains.find(
            (chain) => chain.chainId === targetChainId
          );

          if (!targetChain) {
            throw new UnrecognizedChainError(targetChainId);
          }

          activeChain = targetChain;
          eventEmitter.emit("chainChanged", { chainId: activeChain.chainId });
          return null;
        }
        // @ts-expect-error fall through expected
        case "eth_sendTransaction": {
          const [transaction] = params as WalletRpcSchema[7]["Parameters"];
          const signedTransaction = await request({
            method: "eth_signTransaction",
            params: [transaction],
          });

          // Change the method to 'eth_sendRawTransaction' and pass the signed transaction
          method = "eth_sendRawTransaction";
          params = [signedTransaction];
          // Fall through to 'eth_sendRawTransaction' case
        }
        case "eth_sendRawTransaction":
        case "eth_chainId":
        case "eth_subscribe":
        case "eth_unsubscribe":
        case "eth_blobBaseFee":
        case "eth_blockNumber":
        case "eth_call":
        case "eth_coinbase":
        case "eth_estimateGas":
        case "eth_feeHistory":
        case "eth_gasPrice":
        case "eth_getBalance":
        case "eth_getBlockByHash":
        case "eth_getBlockByNumber":
        case "eth_getBlockReceipts":
        case "eth_getBlockTransactionCountByHash":
        case "eth_getBlockTransactionCountByNumber":
        case "eth_getCode":
        case "eth_getFilterChanges":
        case "eth_getFilterLogs":
        case "eth_getLogs":
        case "eth_getProof":
        case "eth_getStorageAt":
        case "eth_getTransactionByBlockHashAndIndex":
        case "eth_getTransactionByBlockNumberAndIndex":
        case "eth_getTransactionByHash":
        case "eth_getTransactionCount":
        case "eth_getTransactionReceipt":
        case "eth_getUncleCountByBlockHash":
        case "eth_getUncleCountByBlockNumber":
        case "eth_maxPriorityFeePerGas":
        case "eth_newBlockFilter":
        case "eth_newFilter":
        case "eth_newPendingTransactionFilter":
        case "eth_syncing":
        // @ts-expect-error fall through expected
        case "eth_uninstallFilter":
          const {
            rpcUrls: [rpcUrl],
          } = activeChain;
          if (rpcUrl) {
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

            // Set connected status upon successful Ethereum RPC request
            setConnected(true, { chainId: activeChain.chainId });
            return response.result;
          }
        default:
          throw new MethodNotSupportedRpcError(
            new Error(`Invalid method: ${method}`)
          );
      }
    } catch (error: any) {
      if (
        (error.name === "HttpRequestError" &&
          error.details === "fetch failed") ||
        (error instanceof TurnkeyRequestError && turnkeyIsDisconnected(error))
      ) {
        setConnected(false, error);
      }
      throw error;
    }
  };

  if (Array.isArray(chains) && chains.length > 0) {
    for (const chain of chains) {
      await request({
        method: "wallet_addEthereumChain",
        params: [chain],
      });
    }
  }

  isInitialized = true;

  return {
    on: eventEmitter.on.bind(eventEmitter),
    removeListener: eventEmitter.removeListener.bind(eventEmitter),
    request,
  } satisfies EIP1193Provider;
};
