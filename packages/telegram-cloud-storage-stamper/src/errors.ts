export class TelegramCloudStorageStamperError extends Error {
  constructor(message: string) {
    super(`TelegramCloudStorageStamperError: ${message}`);
  }
}

// This error type is for when telegram cloud storage operations return as "no error" but return false in the case of clearing or setting an item
// We were unable to get this value to ever be false, but Telegram's documentation notes that it can happen: https://core.telegram.org/bots/webapps#cloudstorage
export class TelegramSuccessButFalseError extends Error {
  constructor(message: string) {
    super(`TelegramSuccessButFalseError: ${message}`);
  }
}
