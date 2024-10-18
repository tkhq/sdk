export class TelegramStamperError extends Error {
  constructor(message: string) {
    super(`TelegramStamperError: ${message}`);
  }
}
