import type { Network } from "bitcoinjs-lib";

// These constants helps us estimate an upper bound for fees.
// Source: https://x.com/murchandamus/status/1262062602298916865
const INPUT_BYTE_SIZE_UPPER_BOUND = 90;
const OUTPUT_BYTE_SIZE_UPPER_BOUND = 45;

/**
 * Estimate fees for a transaction with N inputs and M output. This function provides an UPPER BOUND.
 * The "proper" approach to estimate fees tighter would be:
 * - make a transaction "for real", sign it
 * - finalize with `psbt.finalizeAllInputs()`
 * - get the transaction byte size with `psbt.extractTransaction().toHex()`;
 * - then modify the transaction (adjust fees/change) and re-sign
 * Given this is a test-only script we're comfortable over-paying a bit. Miners, rejoice!
 */
export async function estimateFees(feeParams: {
  numInputs: number;
  numOutputs: number;
  network: Network;
}): Promise<number> {
  const { numInputs, numOutputs, network } = feeParams;
  const feePerByteResponse = await getFeePerByte(network);
  const feePerByte: number = feePerByteResponse.hourFee;
  return (
    feePerByte *
    (INPUT_BYTE_SIZE_UPPER_BOUND * numInputs +
      OUTPUT_BYTE_SIZE_UPPER_BOUND * numOutputs)
  );
}

/**
 * Fetch the right fee-per-byte for the passed in network.
 */
async function getFeePerByte(network: Network) {
  try {
    const url =
      network.bech32 === "bc"
        ? "https://mempool.space/api/v1/fees/recommended"
        : "https://mempool.space/testnet/api/v1/fees/recommended";
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("Error fetching fee estimate:", error);
    throw error;
  }
}
