export class WalletStamperError extends Error {
  constructor(message: string, public originalError: any) {
    super(`${message} - error: ${originalError.message}`);
    this.name = 'WalletStamperError';
  }
}
