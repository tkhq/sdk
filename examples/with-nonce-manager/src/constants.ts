// These defaults should be suitable for most testnets.
// For Polygon Mainnet, consider using at least 40 gwei for both parameters for consistent performance.
export const DEFAULT_MAX_FEE_PER_GAS = 1000000000; // 1 gwei
export const DEFAULT_MAX_PRIORITY_FEE_PER_GAS = 1000000000; // 1 gwei

// This should be a minimum of 1.1 per Geth's default behavior expecting (legacy tx) replacements
// to have at least a 10% gas price bump.
// See: https://github.com/ethereum/go-ethereum/blob/699243f8ae870fa2ddbc5cb919fda85313e4684a/core/txpool/legacypool/legacypool.go#L149
export const DEFAULT_GAS_MULTIPLIER = 1.5;

// Feel free to tweak these parameters as you see fit. Potential considerations to keep in mind
// include block times (transaction throughput), rate limits, etc.
export const DEFAULT_REFRESH_TIME_MS = 5000;
export const DEFAULT_TX_WAIT_TIME_MS = 15000;
export const DEFAULT_TOTAL_WAIT_TIME_MS = 60000;
