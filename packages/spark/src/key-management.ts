import type {
  TurnkeyApiClient,
  v1AddressFormat,
  v1WalletAccount,
} from "@turnkey/sdk-server";
import { SPARK_IDENTITY_SUFFIX } from "./constants";
import { uint8ArrayFromHexString } from "@turnkey/encoding";
import asyncRetry from "async-retry";
import {
  compressedPublicKeyHexFromAccount,
  isAlreadyExistsError,
  isNotFoundError,
} from "./utils";

const COMPRESSED_ADDRESS_FORMAT: v1AddressFormat = "ADDRESS_FORMAT_COMPRESSED";

export abstract class TurnkeyKeyManager<K, V extends Uint8Array = Uint8Array> {
  // Holds promises for in-flight fetches to prevent duplicate fetches for the same key
  private readonly promises: Map<K, Promise<void>> = new Map();

  // Holds the actual key-value pairs. Values are Uint8Arrays that can be wiped in place.
  private readonly values: Map<K, V>;

  constructor(values: Map<K, V> = new Map()) {
    this.values = new Map(values);
  }

  async get(id: K): Promise<V | undefined> {
    // If we already have the value, return it immediately
    if (this.values.has(id)) return this.values.get(id);

    // If there is no in-flight fetch for this id, start one
    if (!this.promises.has(id)) {
      // We'll create a promise that fetches the value and stores it once fetched.
      // This promise will be stored in the `promises` map to indicate that a fetch is in progress for this id.
      //
      // In order to not get into any issues with JS task scheduling, this promise will encapsulate
      // the entire fetch-and-store logic, including the final storing of the fetched value and the cleanup of the promise from the map.
      const fetched = this.fetch(id)
        .then((value) => {
          // If we don't get anything, forget about it
          if (value == null) return;

          // Before we store anything, we check if the promise in the map is still the same one we created.
          // If it isn't, it means that either:
          // - The value was deleted while we were fetching
          // - The value was set while we were fetching
          if (this.promises.get(id) === fetched) this.set(id, value);
        })
        .finally(() => {
          // We clean up the promise from the map once it's done. Again, we check if it's still the same
          if (this.promises.get(id) === fetched) this.promises.delete(id);
        });

      // Store the promise in the map to indicate that a fetch is in progress for this id
      this.promises.set(id, fetched);
    }

    // Wait for any in-flights to complete
    await this.promises.get(id);

    // And return the value
    return this.values.get(id);
  }

  set(id: K, value: V): void {
    // Overwriting a value with itself is a no-op
    if (this.values.get(id) === value) return;

    // We first wipe any existing value
    this.delete(id);

    // Only then do we set the new one
    this.values.set(id, value);
  }

  async delete(id: K): Promise<void> {
    // Remove any in-flight fetch for this id
    this.promises.delete(id);

    // If there was a value, wipe it and remove it from the map
    if (this.values.has(id)) {
      const oldValue = this.values.get(id)!;

      this.values.delete(id);
      await this.wipe(oldValue);
    }
  }

  // Subclasses can implement this method to fetch a value for a given id.
  protected async fetch(_id: K): Promise<V | undefined> {
    return undefined;
  }

  // Subclasses can implement this method to wipe a value in place before it's deleted or overwritten.
  // This is important for security-sensitive values like cryptographic keys.
  protected async wipe(value: V): Promise<void> {
    value.fill(0);
  }
}

export class TurnkeySparkSecretKeyManager extends TurnkeyKeyManager<number> {
  protected override async wipe(value: Uint8Array): Promise<void> {
    value.fill(0);
  }
}

export class TurnkeySparkSigningKeyManager extends TurnkeyKeyManager<string> {
  constructor(
    private readonly apiClient: TurnkeyApiClient,
    private readonly sparkAddress: string,
    private readonly walletId?: string,
    values?: Map<string, Uint8Array>,
  ) {
    super(values);
  }

  protected override fetch(path: string): Promise<Uint8Array> {
    return this.createOrReuseSparkAccountPublicKey(path);
  }

  protected override async wipe(value: Uint8Array): Promise<void> {
    value.fill(0);
  }

  protected async createOrReuseSparkAccountPublicKey(
    relativePath: string,
  ): Promise<Uint8Array> {
    const sparkAccount = await this.findSparkIdentityAccount();
    if (!sparkAccount.account.path.endsWith(SPARK_IDENTITY_SUFFIX)) {
      throw new Error(
        `Spark identity account path must end in ${SPARK_IDENTITY_SUFFIX}, got ${sparkAccount.account.path}`,
      );
    }

    const basePath = sparkAccount.account.path.slice(
      0,
      -SPARK_IDENTITY_SUFFIX.length,
    );
    const path = `${basePath}${relativePath}`;
    let account = await this.fetchWalletAccountByPath(
      sparkAccount.walletId,
      path,
    );

    if (!account || !compressedPublicKeyHexFromAccount(account)) {
      account = await this.createWalletAccount(sparkAccount.walletId, path);
    }

    const publicKeyHex = account && compressedPublicKeyHexFromAccount(account);
    if (!publicKeyHex) {
      throw new Error(`Could not load Spark account public key for ${path}`);
    }

    return uint8ArrayFromHexString(publicKeyHex);
  }

  private async findSparkIdentityAccount(): Promise<{
    walletId: string;
    account: v1WalletAccount;
  }> {
    let walletIds: string[];
    if (this.walletId != null) {
      walletIds = [this.walletId];
    } else {
      const { wallets } = await this.apiClient.getWallets({
        organizationId: this.apiClient.config.organizationId,
      });

      walletIds = wallets.map(({ walletId }) => walletId);
    }

    for (const walletId of walletIds) {
      const accounts = await this.getWalletAccounts(walletId);
      const account = accounts.find(
        (candidate) => candidate.address === this.sparkAddress,
      );

      if (account) return { walletId, account };
    }

    throw new Error(
      `Could not find a Turnkey wallet containing Spark address ${this.sparkAddress}`,
    );
  }

  private async fetchWalletAccountByPath(
    walletId: string,
    path: string,
  ): Promise<v1WalletAccount | undefined> {
    try {
      const { account } = await this.apiClient.getWalletAccount({
        organizationId: this.apiClient.config.organizationId,
        walletId,
        path,
      });
      return account;
    } catch (err) {
      if (isNotFoundError(err)) return undefined;
      throw err;
    }
  }

  private async createWalletAccount(
    walletId: string,
    path: string,
  ): Promise<v1WalletAccount> {
    try {
      await this.apiClient.createWalletAccounts({
        organizationId: this.apiClient.config.organizationId,
        walletId,
        accounts: [
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path,
            addressFormat: COMPRESSED_ADDRESS_FORMAT,
          },
        ],
      });
    } catch (err) {
      if (!isAlreadyExistsError(err)) throw err;
    }

    return await asyncRetry(
      async () => {
        const account = await this.fetchWalletAccountByPath(walletId, path);

        if (account && compressedPublicKeyHexFromAccount(account))
          return account;

        throw new Error(`Could not fetch wallet account for path ${path}`);
      },
      { retries: 6, minTimeout: 500, factor: 1.2 },
    );
  }

  private async getWalletAccounts(
    walletId: string,
  ): Promise<v1WalletAccount[]> {
    const { accounts } = await this.apiClient.getWalletAccounts({
      organizationId: this.apiClient.config.organizationId,
      walletId,
    });
    return accounts;
  }
}
