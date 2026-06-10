import { TurnkeyError } from "@turnkey/sdk-server";

export interface UTXOLike<TValue extends number | bigint = number | bigint> {
  value: TValue;
}

/**
 * Selects UTXOs from the provided list of inputs until the total value
 * of the selected UTXOs meets or exceeds the specified output value.
 *
 * It does not perform any optimization and selects UTXOs in the order they are provided.
 *
 * Simple optimizations can be achieved by sorting the inputs before calling this function, for example:
 *
 * - To minimize the number of UTXOs used, sort the inputs in descending order by value. See {@link largestUTXOValueFirst}.
 * - To maximize the number of UTXOs used, sort the inputs in ascending order by value. See {@link smallestUTXOValueFirst}.
 *
 * @param inputs The list of available UTXOs to select from.
 * @param outputValue The target value that the selected UTXOs should meet or exceed.
 * @returns A tuple containing the selected UTXOs and the change amount.
 */
export const selectInputUTXOs = <
  TValue extends number | bigint = number | bigint,
  TUTXO extends UTXOLike<TValue> = UTXOLike<TValue>,
>(
  inputs: TUTXO[],
  outputValue: NoInfer<TValue>,
): [outputs: TUTXO[], change: bigint, unused: TUTXO[]] => {
  if (inputs.length === 0) {
    throw new TurnkeyError("No inputs provided for selectInputUTXOs");
  }

  let selectedInputs: TUTXO[] = [];
  let unusedInputs: TUTXO[] = [...inputs];
  let remainingOutputValue = BigInt(outputValue);

  for (const input of inputs) {
    const inputValue = BigInt(input.value);

    // Update the remaining value and select the input
    remainingOutputValue -= inputValue;
    selectedInputs.push(input);

    // Remove the selected input from the unused inputs
    unusedInputs.shift();

    // If there's nothing left to cover, we can stop selecting more inputs
    if (remainingOutputValue <= 0n) break;
  }

  if (remainingOutputValue > 0n) {
    throw new TurnkeyError(
      `Insufficient input value for selectInputUTXOs. Need ${remainingOutputValue} more.`,
    );
  }

  return [selectedInputs, -remainingOutputValue, unusedInputs];
};

/**
 * Helper UTXO comparator function to sort UTXOs in ascending order by value.
 */
export const smallestUTXOValueFirst = <
  TValue extends number | bigint = number | bigint,
  TUTXO extends UTXOLike<TValue> = UTXOLike<TValue>,
>(
  a: TUTXO,
  b: TUTXO,
): number => {
  return BigInt(a.value) < BigInt(b.value) ? -1 : 1;
};

/**
 * Helper UTXO comparator function to sort UTXOs in descending order by value.
 */
export const largestUTXOValueFirst = <
  TValue extends number | bigint = number | bigint,
  TUTXO extends UTXOLike<TValue> = UTXOLike<TValue>,
>(
  a: TUTXO,
  b: TUTXO,
): number => {
  return BigInt(a.value) > BigInt(b.value) ? -1 : 1;
};
