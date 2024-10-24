export class TelegramCloudStorageStamperError extends Error {
  constructor(message: string) {
    super(`TelegramCloudStorageStamperError: ${message}`);
  }
}
