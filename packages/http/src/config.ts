type TNullable<T> = { [K in keyof T]: T[K] | null };

type TConfig = {
  /**
   * Turnkey API public key
   */
  apiPublicKey: string;
  /**
   * Turnkey API private key
   */
  apiPrivateKey: string;
  /**
   * Turnkey API base URL
   */
  baseUrl: string;
};

const config: TNullable<TConfig> = {
  apiPublicKey: null,
  apiPrivateKey: null,
  baseUrl: null,
};

export function init(value: TConfig): void {
  config.apiPublicKey = assertNonEmptyString(
    value.apiPublicKey,
    "apiPublicKey"
  );

  config.apiPrivateKey = assertNonEmptyString(
    value.apiPrivateKey,
    "apiPrivateKey"
  );
  config.baseUrl = assertNonEmptyString(value.baseUrl, "baseUrl");
}

export function getConfig(): TConfig {
  return {
    apiPublicKey: assertNonEmptyString(config.apiPublicKey, "apiPublicKey"),
    apiPrivateKey: assertNonEmptyString(config.apiPrivateKey, "apiPrivateKey"),
    baseUrl: assertNonEmptyString(config.baseUrl, "baseUrl"),
  };
}

function assertNonEmptyString(input: unknown, name: string): string {
  if (typeof input !== "string" || !input) {
    throw new Error(`"${name}" must be a non-empty string`);
  }

  return input;
}
