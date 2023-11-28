import { TFormattedWallet } from "./types";

export function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}

/**
 * This function returns the next available BIP 32 path for the wallet
 * For example: a wallet with the last address at "m/44'/60'/0'/0/13" will yield "m/44'/60'/0'/0/14"
 * @param wallet
 */
export function getNextPath(wallet: TFormattedWallet): string {
  const lastAccount = wallet.accounts[wallet.accounts.length - 1];
  const lastAccountNum = parseInt(lastAccount.path.split("/")[5]);
  return lastAccount.path
    .split("/")
    .slice(0, 5)
    .concat((lastAccountNum + 1).toString())
    .join("/");
}
