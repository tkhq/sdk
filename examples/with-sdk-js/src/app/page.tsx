"use client";
import Image from "next/image";

import { useEffect, useState } from "react";
import { OAuthProviders, v1AddressFormat } from "@turnkey/sdk-types";
import {
  AuthState,
  Chain,
  ClientState,
  OtpType,
  useTurnkey,
  Wallet,
  WalletAccount,
  WalletSource,
} from "@turnkey/react-wallet-kit";
import { createAccount } from "@turnkey/viem";
import { createWalletClient, http, type Account } from "viem";
import { parseEther, Transaction as EthTransaction } from "ethers";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

export default function AuthPage() {
  const [email, setEmail] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [emailOtpCode, setEmailOtpCode] = useState<string>("");
  const [smsOtpCode, setSmsOtpCode] = useState<string>("");
  const [otpId, setOtpId] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newPhoneNumber, setNewPhoneNumber] = useState<string>("");
  const [newUserName, setNewUserName] = useState<string>("");

  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState<string>("");
  const [activeWallet, setActiveWallet] = useState<Wallet | null>(null);
  const [activeWalletAccount, setActiveWalletAccount] =
    useState<WalletAccount | null>(null);

  const {
    httpClient,
    session,
    allSessions,
    clientState,
    authState,
    wallets,
    user,
  } = useTurnkey();

  const turnkey = useTurnkey();

  useEffect(() => {
    console.log("wallets:", wallets);
  }, [wallets, session]);

  useEffect(() => {
    console.log("User:", user);
  }, [user, session]);

  useEffect(() => {
    console.log("All Sessions:", allSessions);
  }, [allSessions]);

  useEffect(() => {
    const handleGetActiveSessionKey = async () => {
      console.log("Session changed:", session);
      if (!session) {
        setActiveSessionKey(null);
        return;
      }
      const key = await turnkey.getActiveSessionKey();
      console.log("Active session key:", key);
      setActiveSessionKey(key ?? null);
    };

    if (authState === AuthState.Authenticated) {
      handleGetActiveSessionKey();
    }
  }, [authState, session]);

  useEffect(() => {
    console.log("Client state", clientState);
  }, [clientState]);

  const handleVerifyOtp = async (
    otpCode: string,
    contact: string,
    otpType: OtpType,
  ) => {
    const res = await turnkey.completeOtp({
      otpId,
      otpCode,
      contact,
      otpType,
    });

    console.log("OTP verification response:", res);
  };

  const doSignMessage = async () => {
    if (
      !activeWallet ||
      !activeWallet.accounts ||
      activeWallet.accounts.length < 1
    ) {
      console.error("No active wallet selected");
      return;
    }

    for (const walletAccount of activeWallet.accounts) {
      const res = await turnkey.signMessage({
        message: "Hello, Turnkey!",
        walletAccount,
      });
      console.log("Signed message response:", res);
    }
  };

  const signWithViem = async () => {
    const turnkeyAccount = await createAccount({
      client: httpClient!,
      organizationId: session?.organizationId!,
      signWith: wallets[0].accounts[0].address,
    });

    const viemClient = createWalletClient({
      account: turnkeyAccount as Account,
      chain: {
        id: 11_155_111,
        name: "Sepolia",
        nativeCurrency: {
          name: "Sepolia Ether",
          symbol: "ETH",
          decimals: 18,
        },
        rpcUrls: {
          default: {
            http: ["https://sepolia.drpc.org"],
          },
        },
        blockExplorers: {
          default: {
            name: "Etherscan",
            url: "https://sepolia.etherscan.io",
            apiUrl: "https://api-sepolia.etherscan.io/api",
          },
        },
        contracts: {
          multicall3: {
            address: "0xca11bde05977b3631167028862be2a173976ca11",
            blockCreated: 751532,
          },
          ensRegistry: {
            address: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
          },
          ensUniversalResolver: {
            address: "0xc8Af999e38273D658BE1b921b88A9Ddf005769cC",
            blockCreated: 5_317_080,
          },
        },
        testnet: true,
      },
      transport: http(
        `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY!}`,
      ),
    });

    const signature = await viemClient.signMessage({
      message: "Hello, Turnkey!",
    });

    console.log("Viem Signature:", signature);
  };

  const switchSession = async (sessionKey: string) => {
    await turnkey.setActiveSession({ sessionKey });
  };

  const showLoginModal = () => {
    turnkey.handleLogin();
  };

  const showSigningModal = async () => {
    if (
      (wallets.length === 0 && !wallets[0]) ||
      !wallets[0].accounts ||
      wallets[0].accounts.length < 1
    ) {
      console.error("No wallets available to sign message");
      return;
    }

    const result = await turnkey.handleSignMessage({
      message:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. . Sed id maximus elit. Mauris lacus ligula, dictum nec purus sit amet, mollis tempor nisl. Morbi neque lectus, tempor sed tristique sit amet, ornare eget dui",
      walletAccount: wallets[0].accounts[0],
    });
    console.log("Signing result:", result);
  };

  //
  const getAuthStateColour = (state: AuthState) => {
    switch (state) {
      case AuthState.Authenticated:
        return "text-green-800";
      case AuthState.Unauthenticated:
        return "text-red-800";
      default:
        return "text-gray-800";
    }
  };

  const getClientStateColour = (state: ClientState | undefined) => {
    switch (state) {
      case ClientState.Ready:
        return "text-green-800";
      case ClientState.Error:
        return "text-red-800";
      default:
        return "text-gray-800";
    }
  };

  return (
    <main className="p-4 flex flex-col gap-4">
      <div className="flex items-center relative mb-4">
        <a
          href="https://www.turnkey.com"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-1/2 -translate-y-1/2"
        >
          <Image
            src="/logo.svg"
            alt="Turnkey Logo"
            width={100}
            height={24}
            priority
          />
        </a>
        <h1 className="w-full text-center text-lg">
          Turnkey react-wallet-kit playground
        </h1>
      </div>
      <div className="max-w-screen">
        <h2>Managed States</h2>
        <div className="flex flex-wrap gap-2">
          <p
            data-testid="auth-state"
            className="p-2 border bg-neutral-100 w-fit rounded"
          >
            Auth State:{" "}
            <span
              data-testid="auth-state-value"
              className={getAuthStateColour(authState)}
            >
              {authState}
            </span>
          </p>
          <p
            data-testid="client-state"
            className="p-2 border bg-neutral-100 w-fit rounded"
          >
            Client State:{" "}
            <span
              data-testid="client-state-value"
              className={getClientStateColour(clientState)}
            >
              {clientState ?? "undefined"}
            </span>
          </p>
        </div>
        <div>
          <h3>Sessions</h3>
          <div className="flex flex-wrap gap-2">
            {allSessions &&
              Object.keys(allSessions).map((key: string) => (
                <div
                  data-testid={`session-${key}`}
                  key={allSessions[key].publicKey}
                  className="p-2 text-xs border bg-neutral-100 rounded"
                >
                  <p className="truncate">
                    Session:{" "}
                    <span data-testid={`session-key-${key}`}>{key}</span>
                  </p>
                  <p className="max-w-lg break-words line-clamp-3">
                    Token: {allSessions[key].token}
                  </p>
                  <p className="truncate">Expiry: {allSessions[key].expiry}</p>
                  <p className="truncate">
                    Session Public Key: {allSessions[key].publicKey}
                  </p>
                  <p className="truncate">
                    Organization ID: {allSessions[key].organizationId}
                  </p>
                  <p className="truncate">User ID: {allSessions[key].userId}</p>
                </div>
              ))}
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-4 mb-2">
            <h3>Turnkey Wallets</h3>
            <button
              data-testid="create-wallet"
              onClick={async () => {
                const allAddressFormats: v1AddressFormat[] = [
                  "ADDRESS_FORMAT_ETHEREUM",
                  "ADDRESS_FORMAT_SOLANA",
                ];

                console.log(
                  await turnkey.createWallet({
                    walletName: `My Wallet ${new Date().toISOString()}`,
                    accounts: allAddressFormats,
                  }),
                );
              }}
              style={{
                backgroundColor: "yellowgreen",
                borderRadius: "8px",
                padding: "4px 16px",
                color: "black",
              }}
            >
              Create Wallet
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {wallets && wallets.length > 0
              ? wallets.map((wallet: Wallet) => {
                  let count = 0;
                  if (wallet.source === WalletSource.Embedded)
                    return (
                      <div
                        data-testid={`wallet-${count}`}
                        key={wallet.walletId}
                        className="p-2 text-xs border bg-neutral-100 rounded justify-between flex flex-col"
                      >
                        <div>
                          <p className="truncate">
                            Wallet ID:{" "}
                            <span data-testid={`wallet-id-value-${count}`}>
                              {wallet.walletId}
                            </span>
                          </p>
                          <p className="truncate">
                            Wallet Name:{" "}
                            <span data-testid={`wallet-name-value-${count}`}>
                              {wallet.walletName}
                            </span>
                          </p>
                          <p className="truncate">Accounts:</p>
                          <div
                            data-testid={`wallet-accounts-${count}`}
                            className="flex flex-col gap-1"
                          >
                            {wallet.accounts.map((account, i) => {
                              return (
                                <button
                                  data-testid={`set-active-wallet-account-${count}-${i}`}
                                  className="text-left !p-1"
                                  key={account.address}
                                  onClick={() =>
                                    setActiveWalletAccount(account)
                                  }
                                >
                                  <span
                                    data-testid={`wallet-account-address-value-${count}-${i}`}
                                  >
                                    {account.address}
                                  </span>
                                  {activeWallet?.walletId ===
                                    wallet.walletId && (
                                    <span
                                      className={`ml-2 ${activeWalletAccount?.address === account.address ? "text-green-500" : "text-gray-500"}`}
                                    >
                                      {activeWalletAccount?.address ===
                                      account.address
                                        ? " (Active)"
                                        : "(Set Active)"}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-1 w-full">
                          <button
                            data-testid={`create-eth-account-${count}`}
                            style={{
                              backgroundColor: "blue",
                              borderRadius: "8px",
                              padding: "4px 8px",
                              color: "white",
                              marginTop: "8px",
                            }}
                            onClick={async () => {
                              console.log(
                                await turnkey.createWalletAccounts({
                                  accounts: ["ADDRESS_FORMAT_ETHEREUM"],
                                  walletId: wallet.walletId,
                                }),
                              );
                            }}
                          >
                            Create Eth Wallet Account
                          </button>
                          <button
                            data-testid={`create-sol-account-${count}`}
                            style={{
                              backgroundColor: "pink",
                              borderRadius: "8px",
                              padding: "4px 8px",
                              color: "black",
                              marginTop: "8px",
                            }}
                            onClick={async () => {
                              console.log(
                                await turnkey.createWalletAccounts({
                                  accounts: ["ADDRESS_FORMAT_SOLANA"],
                                  walletId: wallet.walletId,
                                }),
                              );
                            }}
                          >
                            Create Sol Wallet Account
                          </button>
                          <button
                            data-testid={`create-btc-account-${count}`}
                            style={{
                              backgroundColor: "orange",
                              borderRadius: "8px",
                              padding: "4px 8px",
                              color: "black",
                              marginTop: "8px",
                            }}
                            onClick={async () => {
                              console.log(
                                await turnkey.createWalletAccounts({
                                  accounts: [
                                    "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH",
                                  ],
                                  walletId: wallet.walletId,
                                }),
                              );
                            }}
                          >
                            Create BTC Wallet Account
                          </button>
                        </div>
                        <button
                          data-testid={`set-active-wallet-${count}`}
                          onClick={() => setActiveWallet(wallet)}
                          className={`transition-all  mt-auto p-1 rounded w-full text-xs ${activeWallet?.walletId !== wallet.walletId ? "bg-blue-200" : "bg-neutral-300"}`}
                          disabled={activeWallet?.walletId === wallet.walletId}
                        >
                          {activeWallet?.walletId === wallet.walletId
                            ? "Active"
                            : "Set Active"}
                        </button>
                      </div>
                    );
                  count++;
                })
              : null}
          </div>
        </div>
      </div>
      <div>
        <h2>Modals</h2>
        <div className="flex flex-wrap gap-2">
          <button
            data-testid="show-auth-modal"
            onClick={showLoginModal}
            style={{
              backgroundColor: "purple",
              borderRadius: "8px",
              padding: "8px 16px",
              color: "white",
            }}
          >
            Show Auth Component Modal
          </button>
          {authState === AuthState.Authenticated && (
            <>
              <button
                data-testid="show-signing-modal"
                onClick={showSigningModal}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Signing Modal
              </button>
              <button
                data-testid="show-export-wallet-modal"
                onClick={async () => {
                  if (!activeWallet) {
                    console.error("No active wallet selected");
                    return;
                  }
                  console.log(
                    await turnkey.handleExportWallet({
                      walletId: activeWallet?.walletId,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Export Wallet Modal
              </button>
              <button
                data-testid="show-export-wallet-account-modal"
                onClick={async () => {
                  if (!activeWalletAccount) {
                    console.error("No active wallet selected");
                    return;
                  }
                  console.log(
                    await turnkey.handleExportWalletAccount({
                      address: activeWalletAccount.address,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Export Wallet Account Modal
              </button>

              <button
                data-testid="show-import-wallet-modal"
                onClick={async () =>
                  console.log(
                    await turnkey.handleImportWallet({
                      defaultWalletAccounts: [
                        "ADDRESS_FORMAT_SOLANA",
                        "ADDRESS_FORMAT_ETHEREUM",
                      ],
                      successPageDuration: 5000,
                    }),
                  )
                }
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Import Wallet Modal
              </button>

              <button
                data-testid="show-update-user-email-modal"
                onClick={async () =>
                  console.log(
                    await turnkey.handleUpdateUserEmail({
                      successPageDuration: 5000,
                    }),
                  )
                }
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Update User Email Modal
              </button>

              <button
                data-testid="show-update-user-phone-modal"
                onClick={async () => {
                  console.log(
                    await turnkey.handleUpdateUserPhoneNumber({
                      successPageDuration: 5000,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Update User Phone Number Modal
              </button>

              <button
                data-testid="show-add-email-modal"
                onClick={async () => {
                  if (!user || !user.authenticators) {
                    console.error("No authenticators found for user");
                    return;
                  }
                  console.log(
                    await turnkey.handleAddEmail({
                      successPageDuration: 5000,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Add Email Modal
              </button>

              <button
                data-testid="show-add-phone-modal"
                onClick={async () => {
                  if (!user || !user.authenticators) {
                    console.error("No authenticators found for user");
                    return;
                  }
                  console.log(
                    await turnkey.handleAddPhoneNumber({
                      successPageDuration: 5000,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Add Phone Number Modal
              </button>

              <button
                data-testid="show-add-passkey-modal"
                onClick={async () => {
                  console.log(
                    await turnkey.handleAddPasskey({
                      successPageDuration: 5000,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Add Passkey
              </button>

              <button
                data-testid="show-remove-passkey-modal"
                onClick={async () => {
                  if (!user || !user.authenticators) {
                    console.error("No authenticators found for user");
                    return;
                  }
                  console.log(
                    await turnkey.handleRemovePasskey({
                      authenticatorId: user?.authenticators[0]?.authenticatorId,
                      successPageDuration: 5000,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Remove Passkey Modal
              </button>

              <button
                data-testid="show-remove-user-email-modal"
                onClick={async () => {
                  if (!user || !user.authenticators) {
                    console.error("No authenticators found for user");
                    return;
                  }
                  console.log(
                    await turnkey.handleRemoveUserEmail({
                      successPageDuration: 5000,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Remove User Email Modal
              </button>

              <button
                data-testid="show-remove-user-phone-modal"
                onClick={async () => {
                  if (!user || !user.authenticators) {
                    console.error("No authenticators found for user");
                    return;
                  }
                  console.log(
                    await turnkey.handleRemoveUserPhoneNumber({
                      successPageDuration: 5000,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Remove User Phone Number Modal
              </button>

              <button
                data-testid="show-connect-external-wallet-modal"
                onClick={async () => {
                  if (!user || !user.authenticators) {
                    console.error("No authenticators found for user");
                    return;
                  }
                  console.log(
                    await turnkey.handleConnectExternalWallet({
                      successPageDuration: 5000,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Connect External Wallet Modal
              </button>

              <button
                data-testid="show-x-oauth-modal"
                onClick={async () => {
                  console.log(await turnkey.handleXOauth());
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show X (Twitter) OAuth
              </button>

              <button
                data-testid="show-discord-oauth-modal"
                onClick={async () => {
                  console.log(await turnkey.handleDiscordOauth());
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Discord OAuth
              </button>

              <button
                data-testid="show-google-oauth-modal"
                onClick={async () => {
                  console.log(await turnkey.handleGoogleOauth());
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Google OAuth
              </button>

              <button
                data-testid="show-apple-oauth-modal"
                onClick={async () => {
                  console.log(await turnkey.handleAppleOauth());
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Apple OAuth
              </button>

              <button
                data-testid="show-facebook-oauth-modal"
                onClick={async () => {
                  console.log(await turnkey.handleFacebookOauth());
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Show Facebook OAuth
              </button>

              <button
                data-testid="add-google-oauth"
                onClick={async () => {
                  console.log(
                    await turnkey.handleAddOauthProvider({
                      providerName: OAuthProviders.GOOGLE,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Add Google OAuth
              </button>

              <button
                data-testid="add-apple-oauth"
                onClick={async () => {
                  console.log(
                    await turnkey.handleAddOauthProvider({
                      providerName: OAuthProviders.APPLE,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Add Apple OAuth
              </button>
              <button
                data-testid="add-facebook-oauth"
                onClick={async () => {
                  console.log(
                    await turnkey.handleAddOauthProvider({
                      providerName: OAuthProviders.FACEBOOK,
                    }),
                  );
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Add Facebook OAuth
              </button>

              <button
                data-testid="remove-oauth-provider"
                onClick={async () => {
                  const providerId = user?.oauthProviders?.[0]?.providerId;
                  if (!providerId) {
                    console.error("No OAuth provider found to remove");
                    return;
                  }
                  const res = await turnkey.handleRemoveOauthProvider({
                    providerId: providerId,
                  });

                  console.log("OAuth provider removed successfully:", res);
                }}
                style={{
                  backgroundColor: "purple",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "white",
                }}
              >
                Remove OAuth Provider
              </button>
            </>
          )}
        </div>
      </div>
      <div>
        <h2>Auth Methods</h2>
        <div className="flex flex-wrap gap-2">
          <button
            data-testid="logout-button"
            onClick={async () => {
              await turnkey.logout();
            }}
            style={{
              backgroundColor: "rebeccapurple",
              borderRadius: "8px",
              padding: "8px 16px",
              color: "white",
            }}
          >
            Logout
          </button>
        </div>
      </div>
      {authState === AuthState.Authenticated && (
        <div>
          <h2>Fetch Methods</h2>
          <div className="flex flex-wrap gap-2">
            <button
              data-testid="get-whoami"
              onClick={async () =>
                console.log(
                  "Successfully called getWhoami",
                  await httpClient?.getWhoami({}),
                )
              }
              style={{
                backgroundColor: "green",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              GetWhoami with IndexedDB
            </button>

            <button
              data-testid="get-active-session"
              onClick={async () => {
                console.log(
                  "Successfully called getActiveSession",
                  await turnkey.getSession(),
                );
              }}
              style={{
                backgroundColor: "green",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Get Active Session
            </button>

            <button
              data-testid="fetch-user"
              onClick={async () => {
                console.log(
                  "Successfully called fetchUser",
                  await turnkey.fetchUser(),
                );
              }}
              style={{
                backgroundColor: "green",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Fetch User
            </button>

            <button
              data-testid="fetch-wallets"
              onClick={async () => {
                console.log(
                  "Successfully called fetchWallets",
                  await turnkey.fetchWallets(),
                );
              }}
              style={{
                backgroundColor: "green",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Fetch Wallets
            </button>

            <button
              data-testid="fetch-wallet-accounts"
              onClick={async () => {
                if (!activeWallet) {
                  console.error("No active wallet selected");
                  return;
                }
                console.log(
                  "Successfully called fetchWalletAccounts",
                  await turnkey.fetchWalletAccounts({
                    wallet: activeWallet,
                  }),
                );
              }}
              style={{
                backgroundColor: "green",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Fetch Wallet Accounts
            </button>

            <button
              data-testid="get-wallet-providers"
              onClick={async () => {
                console.log(
                  "Successfully called fetchWalletProviders",
                  await turnkey.fetchWalletProviders(),
                );
              }}
              style={{
                backgroundColor: "green",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Get Wallet Providers
            </button>
          </div>
        </div>
      )}
      <div>
        <h2>Session Management Methods</h2>
        <div className="flex flex-wrap gap-2">
          {authState === AuthState.Authenticated && (
            <button
              data-testid="get-active-session-2"
              onClick={async () => {
                console.log(
                  "Successfully called getActiveSession",
                  await turnkey.getSession(),
                );
              }}
              style={{
                backgroundColor: "orange",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Get Active Session
            </button>
          )}

          <button
            data-testid="get-all-sessions"
            onClick={async () => {
              console.log(
                "Successfully called getAllSessions",
                await turnkey.getAllSessions(),
              );
            }}
            style={{
              backgroundColor: "orange",
              borderRadius: "8px",
              padding: "8px 16px",
              color: "white",
            }}
          >
            Get All Sessions
          </button>

          {authState === AuthState.Authenticated && (
            <button
              data-testid="clear-active-session"
              onClick={async () => {
                console.log(
                  "Successfully called clearActiveSession",
                  await turnkey.clearSession(),
                );
              }}
              style={{
                backgroundColor: "orange",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Clear Active Session
            </button>
          )}

          <button
            data-testid="clear-all-sessions"
            onClick={async () => {
              console.log(
                "Successfully called clearAllSessions",
                await turnkey.clearAllSessions(),
              );
            }}
            style={{
              backgroundColor: "orange",
              borderRadius: "8px",
              padding: "8px 16px",
              color: "white",
            }}
          >
            Clear All Sessions
          </button>
          {authState === AuthState.Authenticated && (
            <button
              data-testid="refresh-active-session"
              onClick={async () => {
                console.log(
                  "Successfully called refreshActiveSession",
                  await turnkey.refreshSession(),
                );
              }}
              style={{
                backgroundColor: "orange",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Refresh Active Session
            </button>
          )}
        </div>
      </div>
      <div>
        <h2>Multi Session Management Methods</h2>
        <p>
          Active Session:{" "}
          <span
            data-testid="active-session"
            className="rounded bg-neutral-200 w-fit p-1"
          >
            {activeSessionKey ?? "N/A"}
          </span>
        </p>
        <div className="mt-2">
          <p>Available Sessions:</p>
          <div className="flex flex-wrap gap-2 ">
            {allSessions &&
              Object.keys(allSessions).map((key: string) => (
                <button
                  data-testid={`switch-session-${key}`}
                  key={key}
                  className="rounded bg-blue-200 w-fit !p-1 text-sm"
                  onClick={async () => switchSession(key)}
                >
                  {key}
                </button>
              ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <div className="flex gap-2">
            <input
              data-testid="session-key-input"
              type="text"
              placeholder="Enter session key"
              className="p-1 border border-neutral-300 rounded"
              onChange={(e) => setSessionKey(e.target.value)}
            />
            <button
              data-testid="login-with-session-key-button"
              onClick={async () => {
                console.log("Switching to session:", sessionKey);
                await turnkey.handleLogin({
                  sessionKey: sessionKey,
                });
              }}
              style={{
                backgroundColor: "blue",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Login or Sign Up Into New Session
            </button>
          </div>
        </div>
      </div>
      {authState === AuthState.Authenticated && (
        <div>
          <h2>External Wallet Methods</h2>
          <div>
            <h3>Connected Wallets</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {wallets && wallets.length > 0
                ? wallets.map((wallet: Wallet) => {
                    if (wallet.source === WalletSource.Connected)
                      return (
                        <div
                          key={wallet.walletId}
                          className="p-2 text-xs border bg-neutral-100 rounded justify-between flex flex-col"
                        >
                          <div>
                            <p
                              data-testid={`connected-wallet-id-${wallet.walletId}`}
                              className="truncate"
                            >
                              Wallet ID: {wallet.walletId}
                            </p>
                            <p
                              data-testid={`connected-wallet-name-${wallet.walletId}`}
                              className="truncate"
                            >
                              Wallet Name: {wallet.walletName}
                            </p>
                            <p className="truncate">Accounts:</p>
                            <div className="flex flex-col gap-1">
                              {wallet.accounts.map((account) => (
                                <button
                                  data-testid={`set-active-connected-wallet-account-${account.address}`}
                                  className="text-left !p-1"
                                  key={account.address}
                                  onClick={() =>
                                    setActiveWalletAccount(account)
                                  }
                                >
                                  {account.address}
                                  {activeWallet?.walletId ===
                                    wallet.walletId && (
                                    <span
                                      className={`ml-2 ${activeWalletAccount?.address === account.address ? "text-green-500" : "text-gray-500"}`}
                                    >
                                      {activeWalletAccount?.address ===
                                      account.address
                                        ? " (Active)"
                                        : "(Set Active)"}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                          <button
                            data-testid={`set-active-connected-wallet-${wallet.walletId}`}
                            onClick={() => setActiveWallet(wallet)}
                            className={`transition-all  mt-auto p-1 rounded w-full text-xs ${activeWallet?.walletId !== wallet.walletId ? "bg-blue-200" : "bg-neutral-300"}`}
                            disabled={
                              activeWallet?.walletId === wallet.walletId
                            }
                          >
                            {activeWallet?.walletId === wallet.walletId
                              ? "Active"
                              : "Set Active"}
                          </button>
                        </div>
                      );
                  })
                : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              data-testid="get-wallet-providers-2"
              onClick={async () => {
                const providers = await turnkey.fetchWalletProviders();
                console.log("Wallet Providers:", providers);
              }}
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Get Wallet Providers
            </button>

            <button
              data-testid="connect-wallet-account"
              onClick={async () => {
                const providers = await turnkey.fetchWalletProviders();
                console.log("Wallet Providers:", providers);
                await turnkey.connectWalletAccount(providers[4]);
              }}
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Connect A Wallet
            </button>

            <button
              data-testid="sign-up-with-wallet"
              onClick={async () => {
                const provider = await turnkey.fetchWalletProviders(
                  Chain.Solana,
                );
                console.log("Injected Solana Provider:", provider);
                await turnkey.signUpWithWallet({
                  walletProvider: provider[1],
                });
              }}
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Sign Up with Wallet
            </button>

            <button
              data-testid="login-with-wallet"
              onClick={async () => {
                const provider = await turnkey.fetchWalletProviders(
                  Chain.Solana,
                );
                console.log("Injected Solana Provider:", provider);
                await turnkey.loginWithWallet({
                  walletProvider: provider[1],
                });
              }}
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Login with Wallet
            </button>

            <button
              data-testid="continue-with-wallet"
              onClick={async () => {
                const provider = await turnkey.fetchWalletProviders(
                  Chain.Solana,
                );
                console.log("Injected Solana Provider:", provider);
                await turnkey.loginOrSignupWithWallet({
                  walletProvider: provider[1],
                });
              }}
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Continue with Wallet
            </button>

            <button
              data-testid="connect-or-disconnect-wallet"
              onClick={async () => await turnkey.handleConnectExternalWallet()}
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Connect/Disconnect Wallet
            </button>

            <button
              onClick={async () => {
                if (!activeWalletAccount) {
                  console.error("No active wallet account selected");
                  return;
                }
                const tx = {
                  to: "0x0000000000000000000000000000000000000000",
                  value: parseEther("0.001"),
                  nonce: 0,
                  gasLimit: BigInt("21000"),
                  maxFeePerGas: BigInt("1000000000"),
                  maxPriorityFeePerGas: BigInt("1000000000"),
                  chainId: 1,
                };

                const unsignedTransaction =
                  EthTransaction.from(tx).unsignedSerialized;
                console.log("Unsigned Transaction:", unsignedTransaction);

                const signature = await turnkey.signAndSendTransaction({
                  unsignedTransaction,
                  walletAccount: activeWalletAccount,
                  transactionType: "TRANSACTION_TYPE_ETHEREUM",
                });
                console.log("Transaction Signature:", signature);
              }}
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Sign And Send Ethereum Transaction
            </button>

            <button
              onClick={async () => {
                if (!activeWalletAccount) {
                  console.error("No active wallet account selected");
                  return;
                }
                const mainNet = "0x1";

                console.log(
                  "Switching Ethereum chain to mainnet for account:",
                  activeWalletAccount,
                );
                await turnkey.switchWalletAccountChain({
                  walletAccount: activeWalletAccount,
                  chainOrId: mainNet,
                });
              }}
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Switch Ethereum Chain to Mainnet
            </button>

            <button
              onClick={async () => {
                if (!activeWalletAccount) {
                  console.error("No active wallet account selected");
                  return;
                }
                const polygon = "0x89";
                console.log(
                  "Switching Ethereum chain to Polygon for account:",
                  activeWalletAccount,
                );
                await turnkey.switchWalletAccountChain({
                  walletAccount: activeWalletAccount,
                  chainOrId: polygon,
                });
              }}
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Switch Ethereum Chain to Polygon
            </button>
          </div>
        </div>
      )}
      {authState === AuthState.Authenticated && (
        <div>
          <h2>Signing Methods</h2>
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              data-testid="sign-sol-transaction"
              onClick={async () => {
                if (
                  !activeWalletAccount ||
                  activeWalletAccount.addressFormat !== "ADDRESS_FORMAT_SOLANA"
                ) {
                  console.error("No active wallet account selected");
                  return;
                }
                const solanaAccount = activeWalletAccount;
                const from = new PublicKey(solanaAccount.address);

                const tx = new Transaction().add(
                  SystemProgram.transfer({
                    fromPubkey: from,
                    toPubkey: from,
                    lamports: 1_000,
                  }),
                );

                tx.recentBlockhash = "11111111111111111111111111111111";
                tx.feePayer = from;

                const raw = tx.serialize({
                  requireAllSignatures: false,
                  verifySignatures: false,
                });
                const unsignedTransaction = raw.toString("hex");
                console.log("Unsigned Solana tx (hex):", unsignedTransaction);

                const signature = await turnkey.signTransaction({
                  unsignedTransaction,
                  walletAccount: solanaAccount,
                  transactionType: "TRANSACTION_TYPE_SOLANA",
                });
                console.log("Transaction Signature:", signature);
              }}
              style={{
                backgroundColor: "pink",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "black",
              }}
            >
              Sign Solana Transaction
            </button>

            <button
              data-testid="sign-eth-transaction"
              onClick={async () => {
                if (!activeWalletAccount) {
                  console.error("No active wallet account selected");
                  return;
                }
                const tx = {
                  to: "0x0000000000000000000000000000000000000000",
                  value: parseEther("0.001"),
                  nonce: 0,
                  gasLimit: BigInt("21000"),
                  maxFeePerGas: BigInt("1000000000"),
                  maxPriorityFeePerGas: BigInt("1000000000"),
                  chainId: 1,
                };

                const unsignedTransaction =
                  EthTransaction.from(tx).unsignedSerialized;
                console.log("Unsigned Transaction:", unsignedTransaction);

                const signature = await turnkey.signTransaction({
                  unsignedTransaction,
                  walletAccount: activeWalletAccount,
                  transactionType: "TRANSACTION_TYPE_ETHEREUM",
                });
                console.log("Transaction Signature:", signature);
              }}
              style={{
                backgroundColor: "pink",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "black",
              }}
            >
              Sign Ethereum Transaction
            </button>
            <button
              data-testid="sign-message"
              onClick={doSignMessage}
              style={{
                backgroundColor: "pink",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "black",
              }}
            >
              Sign Message
            </button>

            <button
              data-testid="sign-with-viem"
              onClick={signWithViem}
              style={{
                backgroundColor: "pink",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "black",
              }}
            >
              Sign With Viem
            </button>
          </div>
        </div>
      )}
      <div>
        <h2>Otp Methods</h2>
        <div>
          <h3>Email</h3>
          <div className="flex flex-wrap gap-2 mb-2 items-center">
            <input
              type="text"
              placeholder="Enter your email"
              style={{
                margin: "12px 0",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                width: "300px",
              }}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
            />
            <button
              className="h-fit"
              onClick={async () => {
                const res = await turnkey.initOtp({
                  otpType: OtpType.Email,
                  contact: email,
                });

                if (!res) {
                  console.error("Failed to initialize OTP");
                  return;
                }
                setOtpId(res);
              }}
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Init OTP
            </button>

            <input
              type="text"
              placeholder="Enter OTP code"
              style={{
                margin: "12px 0",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                width: "300px",
              }}
              onChange={(e) => {
                setEmailOtpCode(e.target.value);
              }}
            />

            <button
              className="h-fit"
              onClick={() =>
                handleVerifyOtp(emailOtpCode, email, OtpType.Email)
              }
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Verify OTP
            </button>
          </div>
        </div>
        <div>
          <h3>SMS</h3>
          <div className="flex flex-wrap gap-2 mb-2 items-center">
            <input
              type="text"
              placeholder="Enter your phone number"
              style={{
                margin: "12px 0",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                width: "300px",
              }}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
              }}
            />
            <button
              className="h-fit"
              onClick={async () => {
                const res = await turnkey.initOtp({
                  otpType: OtpType.Email,
                  contact: email,
                });

                if (!res) {
                  console.error("Failed to initialize OTP");
                  return;
                }
                setOtpId(res);
              }}
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Init OTP
            </button>

            <input
              type="text"
              placeholder="Enter OTP code"
              style={{
                margin: "12px 0",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                width: "300px",
              }}
              onChange={(e) => {
                setSmsOtpCode(e.target.value);
              }}
            />

            <button
              className="h-fit"
              onClick={() =>
                handleVerifyOtp(smsOtpCode, phoneNumber, OtpType.Sms)
              }
              style={{
                backgroundColor: "rebeccapurple",
                borderRadius: "8px",
                padding: "8px 16px",
                color: "white",
              }}
            >
              Verify OTP
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
