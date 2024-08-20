export const PROVIDER_ERROR_MESSAGE = {
  BLOCK_EXPLORER_URL:
    "Expected null or array with at least one valid string HTTPS URL 'blockExplorerUrl'. Received: ",
  INVALID_CHAIN_ID_HEX:
    "Expected 0x-prefixed, unpadded, non-zero hexadecimal string 'chainId'. Received: ",
  INVALID_CHAIN_ID_VALUE:
    "Expected numerical value greater than max safe value. Received: ",
  NATIVE_CURRENCY_SYMBOL_LENGTH:
    "Expected 2-6 character string 'nativeCurrency.symbol'. Received: ",
  NATIVE_CURRENCY_SYMBOL_MISMATCH:
    "nativeCurrency.symbol does not match currency symbol for a network the user already has added with the same chainId. Received: ",
  INVALID_RPC_URL:
    "rpcUrls field is required and must contain at least one valid HTTP/HTTPS URL",
  UNRECOGNIZED_CHAIN_ID:
    "Unrecognized chain ID. Try adding the chain using wallet_addEthereumChain first. Received: ",
  CHAIN_ID_RPC_MISMATCH:
    "Chain ID does not match the RPC endpoint. Provider Chain ID: ",
  PROVIDER_DISCONNECTED: "Provider is disconnected from chain.",
  RPC_URLS_REQUIRED: "rpcUrls field is required and cannot be empty",
};

export const PROVIDER_ERROR_CODE = {
  ADD_ETHEREUM_CHAIN: -32602,
};

export const TURNKEY_ERROR_CODE = {
  WALLET_NOT_FOUND: 5,
  ORG_NOT_FOUND: 3,
};
