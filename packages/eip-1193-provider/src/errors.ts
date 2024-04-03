import { Hex, ProviderRpcError, hexToNumber } from "viem";
import { PROVIDER_ERROR_CODE, PROVIDER_ERROR_MESSAGE } from "./constants";

// https://docs.metamask.io/wallet/reference/wallet_switchethereumchain/
class UnrecognizedChainError extends ProviderRpcError {
  constructor(chainId: string) {
    const errorMessage = `${PROVIDER_ERROR_MESSAGE.UNRECOGNIZED_CHAIN_ID}${chainId}`;
    super(new Error(errorMessage), {
      code: 4902,
      shortMessage: "Unrecognized chain ID",
    });
  }
}

class ChainIdMismatchError extends ProviderRpcError {
  constructor(providerChainId: Hex, rpcChainId: Hex) {
    super(
      new Error(
        `${PROVIDER_ERROR_MESSAGE.CHAIN_ID_RPC_MISMATCH}${hexToNumber(
          providerChainId
        )} RPC Chain ID: ${hexToNumber(rpcChainId)}`
      ),
      {
        code: 4905,
        shortMessage: "Chain ID mismatch",
      }
    );
  }
}

class BlockExplorerUrlError extends ProviderRpcError {
  constructor() {
    super(new Error(PROVIDER_ERROR_MESSAGE.BLOCK_EXPLORER_URL), {
      code: PROVIDER_ERROR_CODE.ADD_ETHEREUM_CHAIN,
      shortMessage: PROVIDER_ERROR_MESSAGE.BLOCK_EXPLORER_URL,
    });
  }
}

class RpcUrlsRequiredError extends ProviderRpcError {
  constructor() {
    super(new Error(PROVIDER_ERROR_MESSAGE.RPC_URLS_REQUIRED), {
      code: -32602,
      shortMessage: "rpcUrls field is required and cannot be empty",
    });
  }
}

class ChainIdAlreadyAddedError extends ProviderRpcError {
  constructor() {
    super(new Error("Chain ID already added"), {
      code: 4904,
      shortMessage: "Chain ID already added",
    });
  }
}

class InvalidChainIdFormatError extends ProviderRpcError {
  constructor(chainId: string) {
    super(new Error(PROVIDER_ERROR_MESSAGE.INVALID_CHAIN_ID_HEX + chainId), {
      code: PROVIDER_ERROR_CODE.ADD_ETHEREUM_CHAIN,
      shortMessage: "Invalid chain ID format",
    });
  }
}

class ChainIdValueExceedsError extends ProviderRpcError {
  constructor(chainId: string) {
    super(new Error(PROVIDER_ERROR_MESSAGE.INVALID_CHAIN_ID_VALUE + chainId), {
      code: PROVIDER_ERROR_CODE.ADD_ETHEREUM_CHAIN,
      shortMessage: "Chain ID value exceeds max safe integer",
    });
  }
}

class InvalidRpcUrlError extends ProviderRpcError {
  constructor() {
    super(new Error(PROVIDER_ERROR_MESSAGE.INVALID_RPC_URL), {
      code: PROVIDER_ERROR_CODE.ADD_ETHEREUM_CHAIN,
      shortMessage: "Invalid rpcUrls",
    });
  }
}

class NativeCurrencySymbolLengthError extends ProviderRpcError {
  constructor(symbol: string) {
    super(
      new Error(PROVIDER_ERROR_MESSAGE.NATIVE_CURRENCY_SYMBOL_LENGTH + symbol),
      {
        code: PROVIDER_ERROR_CODE.ADD_ETHEREUM_CHAIN,
        shortMessage: "Invalid native currency symbol length",
      }
    );
  }
}

class NativeCurrencySymbolMismatchError extends ProviderRpcError {
  constructor(symbol: string) {
    super(
      new Error(
        PROVIDER_ERROR_MESSAGE.NATIVE_CURRENCY_SYMBOL_MISMATCH + symbol
      ),
      {
        code: PROVIDER_ERROR_CODE.ADD_ETHEREUM_CHAIN,
        shortMessage: "Native currency symbol mismatch",
      }
    );
  }
}

export {
  UnrecognizedChainError,
  ChainIdMismatchError,
  BlockExplorerUrlError,
  RpcUrlsRequiredError,
  ChainIdAlreadyAddedError,
  InvalidChainIdFormatError,
  ChainIdValueExceedsError,
  InvalidRpcUrlError,
  NativeCurrencySymbolLengthError,
  NativeCurrencySymbolMismatchError,
};
