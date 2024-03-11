import {
  RpcTransactionRequest,
  TransactionSerializable,
  serializeTransaction,
} from 'viem';

import ReactDOM from 'react-dom';
import type { TurnkeyAuthCallback } from './types';
import type { UUID } from 'crypto';
import type { TurnkeyClient } from '@turnkey/http';

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

export function renderTurnkeyAuth(
  onTurnkeyAuth: TurnkeyAuthCallback
): Promise<{ organizationId: UUID; walletId: UUID }> {
  return new Promise((resolve, reject) => {
    const onComplete = (organizationId: UUID, walletId: UUID) => {
      resolve({ organizationId, walletId });
      // Close the modal or perform any other necessary actions
    };

    const onError = (error: Error) => {
      reject(error);
      // Close the modal or perform any other necessary actions
    };

    const TurnkeyAuthModal = onTurnkeyAuth({ onComplete, onError });

    const containerElement = document.createElement('div');
    document.body.appendChild(containerElement);

    // Render the modal with the TurnkeyAuthModal inside
    ReactDOM.render(TurnkeyAuthModal, containerElement);
  });
}

async function getWalletAndOrganizationId(
  turnkeyClient: TurnkeyClient
): Promise<{ walletId: string; organizationId: string }> {
  let walletId = localStorage.getItem('walletId') || '';
  let organizationId = localStorage.getItem('organizationId') || '';

  if (walletId && organizationId) {
    try {
      const whoAmI = await turnkeyClient.getWhoami({
        organizationId,
      });

      if (whoAmI.walletId !== walletId) {
        // Mismatch between stored walletId and actual walletId
        walletId = '';
        organizationId = '';
      }
    } catch (error) {
      // Handle error
      console.error('Error calling getWhoami:', error);
      walletId = '';
      organizationId = '';
    }
  } else if (organizationId) {
    try {
      const { wallets } = await turnkeyClient.getWallets({
        organizationId,
      });

      const [account] = (
        await Promise.all(
          wallets.map(({ walletId }) =>
            turnkeyClient.getWalletAccounts({ organizationId, walletId })
          )
        )
      )
        .flatMap((walletAccount) => walletAccount.accounts)
        .filter((account) => account.address);

      if (account) {
        walletId = account.walletId;
        localStorage.setItem('walletId', walletId);
        localStorage.setItem('organizationId', organizationId);
      }
    } catch (error) {
      // Handle error
      console.error('Error retrieving walletId:', error);
    }
  }

  return { walletId, organizationId };
}
