import type {
  Transfer,
  TreeNode,
} from "@buildonspark/spark-sdk/dist/proto/spark";
import { TurnkeySparkWallet } from "./wallet";

interface WalletWithClaimTransfer {
  claimTransfer({
    transfer,
    emit,
  }: {
    transfer: Transfer;
    emit?: boolean;
  }): Promise<TreeNode[]>;
  claimTransferBatch(transfers: Transfer[], emit?: boolean): Promise<string[]>;
}

/**
 * This class extends the TurnkeySparkWallet and exposes the claimTransfer and claimTransferBatch methods for testing purposes.
 *
 * It is not supposed to be used outside of tests and should not be used in production code.
 */
export class TurnkeySparkWalletTest extends TurnkeySparkWallet {
  async __claimTransfer__(transfer: Transfer) {
    return (this as unknown as WalletWithClaimTransfer).claimTransfer({
      transfer,
      emit: true,
    });
  }

  async __claimTransferBatch__(transfers: Transfer[]) {
    return (this as unknown as WalletWithClaimTransfer).claimTransferBatch(
      transfers,
      true,
    );
  }
}
