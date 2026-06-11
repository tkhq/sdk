import { createNewSolanaWallet } from "./createSolanaWallet";
import * as solanaNetwork from "./solanaNetwork";
import { signMessage } from "./signMessage";
import { createTransfer } from "./createSolanaTransfer";
import { print } from "./print";
import { createMint } from "./createMint";
import { createToken } from "./createToken";
import { createTokenAccount } from "./createTokenAccount";
import {
  createTokenTransferAddSignature,
  createTokenTransferSignTransaction,
} from "./createTokenTransfer";
import { transactionSenderAndConfirmationWaiter } from "./retrySender";
import { handleActivityError } from "./handleActivityError";

const TURNKEY_WAR_CHEST = "tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C";

export {
  createMint,
  createNewSolanaWallet,
  createToken,
  createTokenAccount,
  createTokenTransferAddSignature,
  createTokenTransferSignTransaction,
  createTransfer,
  handleActivityError,
  print,
  signMessage,
  transactionSenderAndConfirmationWaiter,
  solanaNetwork,
  TURNKEY_WAR_CHEST,
};

export function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string,
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}

// isKeyOfObject checks if a key exists within an object
export function isKeyOfObject<T>(
  key: string | number | symbol | undefined,
  obj: any,
): key is keyof T {
  if (!key) return false;

  return key in obj;
}
