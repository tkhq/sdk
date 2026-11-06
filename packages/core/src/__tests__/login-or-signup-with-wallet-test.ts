import { afterEach, describe, expect, it, jest } from "@jest/globals";

jest.mock(
  "@polyfills/window",
  () => ({
    __esModule: true,
    default: {
      localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
    },
  }),
  { virtual: true },
);
jest.mock(
  "@utils",
  () => ({
    __esModule: true,
    parseSession: jest.fn(),
  }),
  { virtual: true },
);

import {
  AuthAction,
  TurnkeyError,
  TurnkeyErrorCodes,
} from "@turnkey/sdk-types";
import { AUTH_METHOD_WALLET, generateP256KeyPair } from "@turnkey/crypto";
import { hexStringToBase64url } from "@turnkey/encoding";
import { TurnkeyClient } from "../__clients__/core";
import { Chain, FilterType, WalletInterfaceType } from "../__types__";
import type { WalletProvider } from "../__types__";
import { walletApiKeyPublicKeyFromAuthToken } from "../utils";
import { encodeTestVerificationToken } from "./shared";

const EPHEMERAL_PUBLIC_KEY = generateP256KeyPair().publicKey.toLowerCase();
const ETH_ADDRESS = "0xabc0000000000000000000000000000000000000";
const SOL_ADDRESS = "7EcDhSYGxXyscszYEp35KHN8mvjEJNgLtUp4Hq4aKqUd";
const SESSION_TOKEN = "session-jwt";
const ETH_WALLET_PUBLIC_KEY = "04" + "ab".repeat(64);
const SOL_WALLET_PUBLIC_KEY = "cd".repeat(32);

function ethereumToken(overrides?: Record<string, unknown>): string {
  return encodeTestVerificationToken(EPHEMERAL_PUBLIC_KEY, {
    auth_method: AUTH_METHOD_WALLET,
    sub_id: {
      format: "wallet",
      type: "WALLET_AUTHENTICATOR_TYPE_ETHEREUM",
      address: ETH_ADDRESS,
      domain: "app.example.com",
      jwk: {
        kty: "EC",
        crv: "secp256k1",
        x: hexStringToBase64url("ab".repeat(32)),
        y: hexStringToBase64url("ab".repeat(32)),
      },
    },
    ...overrides,
  });
}

function solanaToken(): string {
  return encodeTestVerificationToken(EPHEMERAL_PUBLIC_KEY, {
    auth_method: AUTH_METHOD_WALLET,
    sub_id: {
      format: "wallet",
      type: "WALLET_AUTHENTICATOR_TYPE_SOLANA",
      address: SOL_ADDRESS,
      domain: "app.example.com",
      jwk: {
        kty: "OKP",
        crv: "Ed25519",
        x: hexStringToBase64url(SOL_WALLET_PUBLIC_KEY),
        y: "",
      },
    },
  });
}

function ethProvider(overrides?: Partial<WalletProvider>): WalletProvider {
  return {
    interfaceType: WalletInterfaceType.Ethereum,
    chainInfo: { namespace: Chain.Ethereum, chainId: "0x1" },
    info: { name: "MetaMask" },
    provider: {} as WalletProvider["provider"],
    connectedAddresses: [ETH_ADDRESS],
    ...overrides,
  };
}

function solProvider(): WalletProvider {
  return {
    interfaceType: WalletInterfaceType.Solana,
    chainInfo: { namespace: Chain.Solana },
    info: { name: "Phantom" },
    provider: {} as WalletProvider["provider"],
    connectedAddresses: [SOL_ADDRESS],
  };
}

function createClient() {
  const client = new TurnkeyClient({
    organizationId: "parent-org",
    authProxyConfigId: "proxy-config",
  });

  const proxyGetAccount = jest.fn(
    async (): Promise<{ organizationId?: string }> => ({
      organizationId: "existing-suborg",
    }),
  );
  const proxySignupV3 = jest.fn(async () => ({
    organizationId: "new-suborg",
    appProofs: [{ type: "signup" }],
  }));

  (client as any).httpClient = {
    proxyGetAccount,
    proxySignupV3,
  };
  (client as any).apiKeyStamper = {
    listKeyPairs: async () => [EPHEMERAL_PUBLIC_KEY],
  };

  return { client, proxyGetAccount, proxySignupV3 };
}

describe("TurnkeyClient.loginOrSignupWithWallet", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logs in an existing EVM wallet via verify + attested stampLogin", async () => {
    const { client, proxyGetAccount, proxySignupV3 } = createClient();
    const verificationToken = ethereumToken();

    jest
      .spyOn(client, "createApiKeyPair")
      .mockResolvedValue(EPHEMERAL_PUBLIC_KEY);
    const verify = jest
      .spyOn(client, "verifyWalletAuthenticator")
      .mockResolvedValue({
        verificationToken,
        publicKey: EPHEMERAL_PUBLIC_KEY,
      });
    const login = jest
      .spyOn(client, "loginWithWallet")
      .mockResolvedValue({ sessionToken: SESSION_TOKEN, address: ETH_ADDRESS });
    const sign = jest.spyOn(client, "signWithApiKey");

    const result = await client.loginOrSignupWithWallet({
      walletProvider: ethProvider(),
    });

    expect(verify).toHaveBeenCalledWith({
      walletProvider: expect.objectContaining({
        interfaceType: WalletInterfaceType.Ethereum,
      }),
      publicKey: EPHEMERAL_PUBLIC_KEY,
    });
    expect(proxyGetAccount).toHaveBeenCalledWith({
      filterType: FilterType.WalletAuthToken,
      filterValue: verificationToken,
    });
    expect(proxySignupV3).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
    expect(login).toHaveBeenCalledWith({
      walletProvider: expect.objectContaining({
        interfaceType: WalletInterfaceType.Ethereum,
      }),
      publicKey: EPHEMERAL_PUBLIC_KEY,
      verificationToken,
      organizationId: "existing-suborg",
      sessionKey: "@turnkey/session/v3",
      expirationSeconds: expect.any(String),
    });
    expect(result).toEqual({
      sessionToken: SESSION_TOKEN,
      address: ETH_ADDRESS,
      action: AuthAction.LOGIN,
    });
  });

  it("signs up a new EVM wallet with walletAuthenticators, then logs in with the wallet", async () => {
    const { client, proxyGetAccount, proxySignupV3 } = createClient();
    const verificationToken = ethereumToken();
    proxyGetAccount.mockResolvedValue({});

    jest
      .spyOn(client, "createApiKeyPair")
      .mockResolvedValue(EPHEMERAL_PUBLIC_KEY);
    jest.spyOn(client, "verifyWalletAuthenticator").mockResolvedValue({
      verificationToken,
      publicKey: EPHEMERAL_PUBLIC_KEY,
    });
    const sign = jest
      .spyOn(client, "signWithApiKey")
      .mockResolvedValue("11".repeat(64));
    const login = jest
      .spyOn(client, "loginWithWallet")
      .mockResolvedValue({ sessionToken: SESSION_TOKEN, address: ETH_ADDRESS });

    const result = await client.loginOrSignupWithWallet({
      walletProvider: ethProvider(),
    });

    expect(proxySignupV3).toHaveBeenCalledTimes(1);
    expect(sign).toHaveBeenCalledWith({
      message: expect.any(String),
      publicKey: EPHEMERAL_PUBLIC_KEY,
    });
    expect(proxyGetAccount).toHaveBeenNthCalledWith(1, {
      filterType: FilterType.WalletAuthToken,
      filterValue: verificationToken,
    });
    expect(proxyGetAccount).toHaveBeenNthCalledWith(2, {
      filterType: FilterType.PublicKey,
      filterValue: walletApiKeyPublicKeyFromAuthToken(ETH_WALLET_PUBLIC_KEY),
    });
    const signupCalls = proxySignupV3.mock.calls as unknown as [
      [Record<string, any>, string | undefined],
    ];
    const signupBody = signupCalls[0][0];
    expect(signupBody.walletAuthenticators).toEqual([
      {
        type: "WALLET_AUTHENTICATOR_TYPE_ETHEREUM",
        address: ETH_ADDRESS,
        domain: "app.example.com",
        verificationToken,
      },
    ]);
    expect(signupBody.apiKeys).toEqual([]);
    expect(signupBody.clientSignature).toEqual({
      message: expect.any(String),
      signatures: [
        {
          publicKey: EPHEMERAL_PUBLIC_KEY,
          signature: "11".repeat(64),
          scheme: "CLIENT_SIGNATURE_SCHEME_API_P256",
        },
      ],
    });
    expect(JSON.parse(signupBody.clientSignature.message)).toEqual(
      expect.objectContaining({
        type: "USAGE_TYPE_SIGNUP",
        tokenId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
        signupV3: expect.objectContaining({
          walletAuthenticators: signupBody.walletAuthenticators,
        }),
      }),
    );
    expect(login).toHaveBeenCalledWith(
      expect.objectContaining({
        walletProvider: expect.any(Object),
        publicKey: EPHEMERAL_PUBLIC_KEY,
        verificationToken,
        organizationId: "new-suborg",
      }),
    );
    expect(result).toEqual({
      sessionToken: SESSION_TOKEN,
      appProofs: [{ type: "signup" }],
      address: ETH_ADDRESS,
      action: AuthAction.SIGNUP,
    });
  });

  it("signs up a new Solana wallet with a Solana wallet authenticator", async () => {
    const { client, proxyGetAccount, proxySignupV3 } = createClient();
    const verificationToken = solanaToken();
    proxyGetAccount.mockResolvedValue({});

    jest
      .spyOn(client, "createApiKeyPair")
      .mockResolvedValue(EPHEMERAL_PUBLIC_KEY);
    jest.spyOn(client, "verifyWalletAuthenticator").mockResolvedValue({
      verificationToken,
      publicKey: EPHEMERAL_PUBLIC_KEY,
    });
    jest.spyOn(client, "signWithApiKey").mockResolvedValue("11".repeat(64));
    jest
      .spyOn(client, "loginWithWallet")
      .mockResolvedValue({ sessionToken: SESSION_TOKEN, address: SOL_ADDRESS });

    const result = await client.loginOrSignupWithWallet({
      walletProvider: solProvider(),
    });

    expect(proxyGetAccount).toHaveBeenNthCalledWith(1, {
      filterType: FilterType.WalletAuthToken,
      filterValue: verificationToken,
    });
    expect(proxyGetAccount).toHaveBeenNthCalledWith(2, {
      filterType: FilterType.PublicKey,
      filterValue: SOL_WALLET_PUBLIC_KEY,
    });
    const signupCalls = proxySignupV3.mock.calls as unknown as [
      [Record<string, any>],
    ];
    expect(signupCalls[0][0].walletAuthenticators).toEqual([
      {
        type: "WALLET_AUTHENTICATOR_TYPE_SOLANA",
        address: SOL_ADDRESS,
        domain: "app.example.com",
        verificationToken,
      },
    ]);
    expect(result.action).toBe(AuthAction.SIGNUP);
    expect(result.address).toBe(SOL_ADDRESS);
  });

  it("logs in with attested stampLogin when only a legacy API-key account exists", async () => {
    const { client, proxyGetAccount, proxySignupV3 } = createClient();
    const verificationToken = ethereumToken();
    proxyGetAccount
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ organizationId: "legacy-suborg" });

    jest
      .spyOn(client, "createApiKeyPair")
      .mockResolvedValue(EPHEMERAL_PUBLIC_KEY);
    jest.spyOn(client, "verifyWalletAuthenticator").mockResolvedValue({
      verificationToken,
      publicKey: EPHEMERAL_PUBLIC_KEY,
    });
    const login = jest.spyOn(client, "loginWithWallet").mockResolvedValue({
      sessionToken: SESSION_TOKEN,
      address: ETH_ADDRESS,
    });

    const result = await client.loginOrSignupWithWallet({
      walletProvider: ethProvider(),
    });

    expect(proxyGetAccount).toHaveBeenNthCalledWith(1, {
      filterType: FilterType.WalletAuthToken,
      filterValue: verificationToken,
    });
    expect(proxyGetAccount).toHaveBeenNthCalledWith(2, {
      filterType: FilterType.PublicKey,
      filterValue: walletApiKeyPublicKeyFromAuthToken(ETH_WALLET_PUBLIC_KEY),
    });
    expect(proxySignupV3).not.toHaveBeenCalled();
    expect(login).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: EPHEMERAL_PUBLIC_KEY,
        verificationToken,
        organizationId: "legacy-suborg",
      }),
    );
    expect(result).toEqual({
      sessionToken: SESSION_TOKEN,
      address: ETH_ADDRESS,
      action: AuthAction.LOGIN,
    });
  });

  it("reuses a provided ephemeral public key and does not generate one", async () => {
    const { client } = createClient();
    const providedKey = "03" + "11".repeat(32);
    const verificationToken = ethereumToken();

    const createKey = jest.spyOn(client, "createApiKeyPair");
    jest.spyOn(client, "verifyWalletAuthenticator").mockResolvedValue({
      verificationToken,
      publicKey: EPHEMERAL_PUBLIC_KEY,
    });
    jest
      .spyOn(client, "loginWithWallet")
      .mockResolvedValue({ sessionToken: SESSION_TOKEN, address: ETH_ADDRESS });

    await client.loginOrSignupWithWallet({
      walletProvider: ethProvider(),
      publicKey: providedKey,
    });

    expect(createKey).not.toHaveBeenCalled();
    expect(client.verifyWalletAuthenticator).toHaveBeenCalledWith({
      walletProvider: expect.any(Object),
      publicKey: providedKey,
    });
  });

  it("cleans up a generated session key when verification fails", async () => {
    const { client } = createClient();

    jest
      .spyOn(client, "createApiKeyPair")
      .mockResolvedValue(EPHEMERAL_PUBLIC_KEY);
    jest
      .spyOn(client, "verifyWalletAuthenticator")
      .mockRejectedValue(
        new TurnkeyError(
          "Failed to verify wallet authenticator",
          TurnkeyErrorCodes.VERIFY_WALLET_AUTHENTICATOR_ERROR,
        ),
      );
    const cleanup = jest
      .spyOn(client, "deleteApiKeyPair")
      .mockResolvedValue(undefined);

    await expect(
      client.loginOrSignupWithWallet({
        walletProvider: ethProvider(),
      }),
    ).rejects.toMatchObject({
      code: TurnkeyErrorCodes.VERIFY_WALLET_AUTHENTICATOR_ERROR,
    });
    expect(cleanup).toHaveBeenCalledWith({ publicKey: EPHEMERAL_PUBLIC_KEY });
  });

  it("does not delete a caller-provided session key on failure", async () => {
    const { client } = createClient();

    jest
      .spyOn(client, "verifyWalletAuthenticator")
      .mockRejectedValue(
        new TurnkeyError(
          "Failed to verify wallet authenticator",
          TurnkeyErrorCodes.VERIFY_WALLET_AUTHENTICATOR_ERROR,
        ),
      );
    const cleanup = jest
      .spyOn(client, "deleteApiKeyPair")
      .mockResolvedValue(undefined);

    await expect(
      client.loginOrSignupWithWallet({
        walletProvider: ethProvider(),
        publicKey: EPHEMERAL_PUBLIC_KEY,
      }),
    ).rejects.toMatchObject({
      code: TurnkeyErrorCodes.VERIFY_WALLET_AUTHENTICATOR_ERROR,
    });
    expect(cleanup).not.toHaveBeenCalled();
  });
});
