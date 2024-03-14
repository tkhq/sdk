import {
  RpcTransactionRequest,
  TransactionSerializable,
  serializeTransaction,
} from 'viem';

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
