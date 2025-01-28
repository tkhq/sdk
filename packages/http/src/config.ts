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

type TBrowserConfig = {
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

const browserConfig: TNullable<TBrowserConfig> = {
  baseUrl: null,
};

/**
 * @deprecated use {@link TurnkeyClient} instead, which doesn't rely on global initialization logic.
 */
export function browserInit(value: TBrowserConfig): void {
  browserConfig.baseUrl = assertNonEmptyString(value.baseUrl, "baseUrl");
}

/**
 * @deprecated use {@link TurnkeyClient} instead, which doesn't rely on global initialization logic.
 */
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

export function getBrowserConfig(): TBrowserConfig {
  return {
    baseUrl: assertNonEmptyString(browserConfig.baseUrl, "baseUrl"),
  };
}

function assertNonEmptyString(input: unknown, name: string): string {
  if (typeof input !== "string" || !input) {
    throw new Error(`"${name}" must be a non-empty string`);
  }

  return input;
}
