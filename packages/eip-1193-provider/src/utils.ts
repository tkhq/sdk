import {
  AddEthereumChainParameter,
  Chain,
  RpcTransactionRequest,
  TransactionSerializable,
  serializeTransaction,
} from 'viem';

import type { WalletAddEthereumChain } from './types';
import {
  BlockExplorerUrlError,
  RpcUrlsRequiredError,
  ChainIdAlreadyAddedError,
  InvalidChainIdFormatError,
  ChainIdValueExceedsError,
  InvalidRpcUrlError,
  NativeCurrencySymbolLengthError,
  NativeCurrencySymbolMismatchError,
} from './errors';

export function preprocessTransaction({
  from,
  ...transaction
}: RpcTransactionRequest) {
  // Helper function to handle undefined values and conversion
  const convertValue = <T>(
    value: string | number | undefined,
    converter: (value: string | number) => T,
    defaultValue: T
  ): T => (value !== undefined ? converter(value) : defaultValue);

  const typeMapping: { [key: string]: string } = {
    '0x0': '',
    '0x1': 'eip2930',
    '0x2': 'eip1559',
  };
  const processedTransaction: TransactionSerializable = {
    ...transaction,
    type: typeMapping[transaction.type ?? ''] ?? 'eip1559',
    maxPriorityFeePerGas: convertValue(
      transaction.maxPriorityFeePerGas,
      BigInt,
      0n
    ),
    maxFeePerGas: convertValue(transaction.maxFeePerGas, BigInt, 0n),
    gasPrice: convertValue(transaction.gasPrice, BigInt, 0n),
    value: convertValue(transaction.value, BigInt, 0n),
    nonce: convertValue(
      transaction.nonce,
      (value) => parseInt(value.toString(), 16),
      0
    ),

    gas: convertValue(transaction.gas, BigInt, 0n),
  };
  const serializedTransaction = serializeTransaction(processedTransaction);

  return serializedTransaction.replace(/^0x/, '');
}

export function validateBlockExplorerUrls(
  blockExplorerUrls: WalletAddEthereumChain['blockExplorerUrls'],
  chainName: string
): Chain['blockExplorers'] {
  // Check if blockExplorerUrls is null or an array with at least one valid HTTPS URL
  if (blockExplorerUrls === null) return undefined;

  // Validate that each URL in the array starts with "https://"
  const isValidUrl = (url: string) => /^https:\/\//.test(url);
  if (!blockExplorerUrls.every(isValidUrl)) {
    throw new BlockExplorerUrlError();
  }

  return {
    default: {
      name: `${chainName} Explorer`,
      url: blockExplorerUrls[0],
    },
  };
}

export const validateRpcUrls = (
  rpcUrls: WalletAddEthereumChain['rpcUrls']
): void => {
  if (!rpcUrls || rpcUrls.length === 0) {
    throw new RpcUrlsRequiredError();
  }
};

const isValidUrl = (url: string) => /^https:\/\//.test(url);

export function validateChain(
  chain: AddEthereumChainParameter,
  addedChains: AddEthereumChainParameter[]
) {
  const { rpcUrls, blockExplorerUrls, chainId, nativeCurrency } = chain;

  if (addedChains.some((c) => c.chainId === chainId)) {
    throw new ChainIdAlreadyAddedError();
  }

  let decimalChainId: Chain['id'];
  try {
    decimalChainId = parseInt(chainId, 16);
    // Ensure the chain ID is a 0x-prefixed hexadecimal string and can be parsed to an integer
    if (!/^0x[0-9a-fA-F]+$/.test(chainId) || isNaN(decimalChainId)) {
      throw new InvalidChainIdFormatError(chainId);
    }
  } catch (error) {
    throw new InvalidChainIdFormatError(chainId);
  }

  // Validate chain ID value is not greater than max safe integer value
  if (decimalChainId > Number.MAX_SAFE_INTEGER) {
    throw new ChainIdValueExceedsError(chainId);
  }

  // Validate RPC URLs
  if (!rpcUrls || rpcUrls.length === 0 || !rpcUrls.every(isValidUrl)) {
    throw new InvalidRpcUrlError();
  }
  // Validate Block Explorer URLs
  if (
    blockExplorerUrls &&
    (!Array.isArray(blockExplorerUrls) ||
      blockExplorerUrls.length === 0 ||
      !blockExplorerUrls.every(isValidUrl))
  ) {
    throw new BlockExplorerUrlError();
  }

  // Validate native currency symbol length
  if (
    nativeCurrency &&
    (nativeCurrency.symbol.length < 2 || nativeCurrency.symbol.length > 6)
  ) {
    throw new NativeCurrencySymbolLengthError(nativeCurrency.symbol);
  }

  // Validate native currency symbol does not mismatch for a network the user already has added with the same chainId
  const existingChain = addedChains.find((c) => c.chainId === chainId);
  if (
    existingChain &&
    existingChain.nativeCurrency &&
    nativeCurrency &&
    existingChain.nativeCurrency.symbol !== nativeCurrency.symbol
  ) {
    throw new NativeCurrencySymbolMismatchError(nativeCurrency.symbol);
  }
}
