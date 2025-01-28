export class WalletStamperError extends Error {
  constructor(message: string, public originalError: any = null) {
    super(
      `${message}${originalError ? ` - error: ${originalError.message}` : ""}`
    );
    this.name = "WalletStamperError";
  }
}
