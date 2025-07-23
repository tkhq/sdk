"use client";

import Image from "next/image";
import styles from "./index.module.css";

import { useContext, useEffect, useState } from "react";
import {
  OAuthProviders,
  Session,
  v1AddressFormat,
  v1Attestation,
} from "@turnkey/sdk-types";
import {
  OtpType,
  StamperType,
  useModal,
  useTurnkey,
} from "@turnkey/react-wallet-kit";
import { SessionKey } from "@turnkey/sdk-js/dist/__storage__/base";
import { WalletType } from "@turnkey/wallet-stamper";
import { ExportType } from "@turnkey/react-wallet-kit/dist/components/export";

export default function AuthPage() {
  const [email, setEmail] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [otpId, setOtpId] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newPhoneNumber, setNewPhoneNumber] = useState<string>("");
  const [newUserName, setNewUserName] = useState<string>("");

  const {
    httpClient,
    session,
    allSessions,
    clientState,
    authState,
    wallets,
    user,
    handleLogin,
    handleGoogleOauth,
    createPasskey,
    loginWithPasskey,
    signUpWithPasskey,
    getWalletProviders,
    connectWalletAccount,
    loginWithWallet,
    signUpWithWallet,
    loginOrSignupWithWallet,
    fetchUser,
    fetchWallets,
    initOtp,
    completeOtp,
    handleSignMessage,
    signMessage,
    refreshSession,
    createWallet,
    logout,
    setActiveSession,
    addPasskey,
    createWalletAccounts,
    handleExport,
    handleImport,
    handleUpdateUserEmail,
    handleUpdateUserPhoneNumber,
    handleAddOAuthProvider,
    handleUpdateUserName,
    handleAddEmail,
    handleAddPhoneNumber,
    handleRemoveOAuthProvider,
    handleAddPasskey,
    handleRemovePasskey,
    handleLinkExternalWallet,
  } = useTurnkey();

  useEffect(() => {
    console.log("wallets:", wallets);
  }, [wallets]);

  useEffect(() => {
    console.log("User:", user);
  }, [user]);

  useEffect(() => {
    console.log("All Sessions:", allSessions);
  }, [allSessions]);

  useEffect(() => {
    console.log("Auth state", authState);
  }, [authState]);

  useEffect(() => {
    console.log("Client state", clientState);
  }, [clientState]);

  const logInWithPasskey1 = async () => {
    await loginWithPasskey({ sessionKey: "session-1" });
  };

  const logInWithPasskey2 = async () => {
    await loginWithPasskey({ sessionKey: "session-2" });
  };

  const indexedDB = async () => {
    const resp = await httpClient?.getWhoami({});
    console.log("Response from getWhoami:", resp);
  };

  const handleCreatePasskey = async () => {
    const res = await createPasskey({ stampWith: StamperType.Passkey });
    console.log("Created passkey:", res);
  };

  const getWallets = async () => {
    const res = await fetchWallets();
    if (res) {
      console.log("Wallets:", res);
    }
  };

  const handleVerifyOtp = async () => {
    const res = await completeOtp({
      otpId,
      otpCode,
      contact: email,
      otpType: OtpType.Email,
    });

    console.log("OTP verification response:", res);
  };

  const getUser = async () => {
    const res = await fetchUser();
    if (res) {
      console.log("Users:", res);
    } else {
      console.error("Failed to fetch users");
    }
  };

  const doSignMessage = async () => {
    if (
      (wallets.length === 0 && !wallets[0]) ||
      !wallets[0].accounts ||
      wallets[0].accounts.length < 1
    ) {
      console.error("No wallets available to sign message");
      return;
    }

    for (const walletAccount of wallets[0].accounts) {
      const res = await signMessage({
        message: "Hello, Turnkey!",
        walletAccount,
      });

      console.log("Signed message response:", res);
    }
  };

  const handleRefreshSession = async () => {
    return await refreshSession({});
  };

  const doCreateWallet = async (walletName: string) => {
    // List of all v1AddressFormat values
    const allAddressFormats: v1AddressFormat[] = [
      "ADDRESS_FORMAT_BITCOIN_MAINNET_P2PKH",
      "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH",
      "ADDRESS_FORMAT_APTOS",
      "ADDRESS_FORMAT_ETHEREUM",
      "ADDRESS_FORMAT_SOLANA",
    ];

    const res = await createWallet({
      walletName,
      accounts: allAddressFormats,
      stampWith: StamperType.Passkey,
    });

    console.log("Created wallet response:", res);
  };

  const switchSession = async (sessionKey: string) => {
    await setActiveSession({ sessionKey });
  };

  const showLoginModal = () => {
    handleLogin();
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

    const result = await handleSignMessage({
      message:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. . Sed id maximus elit. Mauris lacus ligula, dictum nec purus sit amet, mollis tempor nisl. Morbi neque lectus, tempor sed tristique sit amet, ornare eget dui",
      walletAccount: wallets[0].accounts[0],
      stampWith: StamperType.Passkey,
    });
    console.log("Signing result:", result);
  };

  return (
    <main className={styles.main}>
      <a
        href="https://www.turnkey.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/logo.svg"
          alt="Turnkey Logo"
          className={styles.turnkeyLogo}
          width={100}
          height={24}
          priority
        />
      </a>

      <button
        onClick={() => {
          handleGoogleOauth({
            clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          });
        }}
      >
        GOOOGEL
      </button>

      <button
        onClick={async () => {
          await signUpWithPasskey({
            passkeyDisplayName: `local-shmocal-passkey_${Date.now()}`,
            createSubOrgParams: {
              passkeyName: `local-shmocal-passkey_${Date.now()}`,
            },
          });
        }}
        style={{
          backgroundColor: "rebeccapurple",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Sign Up with Passkey
      </button>

      <button
        onClick={async () => {
          const providers = await getWalletProviders();
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
        onClick={async () => {
          const providers = await getWalletProviders();
          console.log("Wallet Providers:", providers);
          await connectWalletAccount(providers[4]);
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
        onClick={async () => {
          const provider = await getWalletProviders(WalletType.Solana);
          console.log("Injected Solana Provider:", provider);
          await signUpWithWallet({
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
        onClick={async () => {
          const provider = await getWalletProviders(WalletType.Solana);
          console.log("Injected Solana Provider:", provider);
          await loginWithWallet({
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
        onClick={async () => {
          const provider = await getWalletProviders(WalletType.Solana);
          console.log("Injected Etheruem Provider:", provider);
          await loginOrSignupWithWallet({
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
        onClick={async () => {
          const res = await initOtp({
            otpType: "OTP_TYPE_EMAIL",
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
          setOtpCode(e.target.value);
        }}
      />

      <button
        onClick={() => handleVerifyOtp()}
        style={{
          backgroundColor: "rebeccapurple",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Verify OTP
      </button>

      <button
        onClick={() => logout()}
        style={{
          backgroundColor: "rosybrown",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Logout
      </button>

      <button
        onClick={indexedDB}
        style={{
          backgroundColor: "green",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        GetWhoami with IndexedDB
      </button>

      {session ? (
        <button
          onClick={handleRefreshSession}
          style={{
            backgroundColor: "red",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Refresh Session
        </button>
      ) : null}

      <button
        onClick={() => handleCreatePasskey()}
        style={{
          backgroundColor: "orange",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Create Passkey
      </button>
      <button
        onClick={logInWithPasskey1}
        style={{
          backgroundColor: "blue",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Log in With Passkey Session 1
      </button>
      <button
        onClick={logInWithPasskey2}
        style={{
          backgroundColor: "lightblue",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Log in With Passkey Session 2
      </button>

      <button
        onClick={showLoginModal}
        style={{
          backgroundColor: "purple",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Show Login Modal
      </button>

      <button
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
        onClick={() =>
          handleExport({
            walletId: wallets[0]?.walletId,
            exportType: ExportType.Wallet,
            stampWith: StamperType.Passkey,
          })
        }
        style={{
          backgroundColor: "purple",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Show Export Modal
      </button>

      <button
        onClick={() =>
          handleImport({
            defaultWalletAccounts: [
              "ADDRESS_FORMAT_SOLANA",
              "ADDRESS_FORMAT_ETHEREUM",
            ],
            successPageDuration: 5000,
            stampWith: StamperType.Passkey,
          })
        }
        style={{
          backgroundColor: "purple",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Show Import Modal
      </button>

      {session ? (
        <button
          onClick={getWallets}
          style={{
            backgroundColor: "blue",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Get Wallets
        </button>
      ) : null}

      {session ? (
        <button
          onClick={() => doCreateWallet(`EVERYTHING ${wallets.length + 1}`)}
          style={{
            backgroundColor: "gray",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Create Wallet
        </button>
      ) : null}

      <button
        onClick={() => switchSession(SessionKey.DefaultSessionkey)}
        style={{
          backgroundColor: "lightblue",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Switch to Default Session
      </button>

      <button
        onClick={() => switchSession("session-1")}
        style={{
          backgroundColor: "lightblue",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Switch to Session 1
      </button>

      <button
        onClick={() => switchSession("session-2")}
        style={{
          backgroundColor: "lightblue",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Switch to Session 2
      </button>

      {session ? (
        <button
          onClick={getUser}
          style={{
            backgroundColor: "red",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Get Users
        </button>
      ) : null}

      {wallets.length > 0 && (
        <button
          onClick={doSignMessage}
          style={{
            backgroundColor: "pink",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Sign Message
        </button>
      )}
      {session && (
        <>
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
              setNewEmail(e.target.value);
            }}
          />
          <button
            onClick={async () => {
              await handleUpdateUserEmail({
                successPageDuration: 5000,
                subTitle: "Add your email to your Turnkey Auth Demo account",
              });
            }}
            style={{
              backgroundColor: "rebeccapurple",
              borderRadius: "8px",
              padding: "8px 16px",
              color: "white",
            }}
          >
            Update Email
          </button>
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
              setNewPhoneNumber(e.target.value);
            }}
          />
          <button
            onClick={async () => {
              await handleUpdateUserPhoneNumber({
                successPageDuration: 5000,
                subTitle:
                  "Add your phone number to your Turnkey Auth Demo account",
              });
            }}
            style={{
              backgroundColor: "rebeccapurple",
              borderRadius: "8px",
              padding: "8px 16px",
              color: "white",
            }}
          >
            Update Phone Number
          </button>
          <input
            type="text"
            placeholder="Enter your user name"
            style={{
              margin: "12px 0",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              width: "300px",
            }}
            onChange={(e) => {
              setNewUserName(e.target.value);
            }}
          />
          <button
            onClick={async () => {
              await handleUpdateUserName({
                successPageDuration: 5000,
                subTitle: "Edit your user name",
                stampWith: StamperType.Passkey,
              });
            }}
            style={{
              backgroundColor: "rebeccapurple",
              borderRadius: "8px",
              padding: "8px 16px",
              color: "white",
            }}
          >
            Update User Name
          </button>
        </>
      )}
      {session && (
        <button
          onClick={async () => {
            await handleAddOAuthProvider({
              providerName: OAuthProviders.GOOGLE,
              stampWith: StamperType.Passkey,
            });
          }}
          style={{
            backgroundColor: "rebeccapurple",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Add Google OAuth
        </button>
      )}
      {session && (
        <button
          onClick={async () => {
            await handleAddOAuthProvider({
              providerName: OAuthProviders.APPLE,
            });
          }}
          style={{
            backgroundColor: "rebeccapurple",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Add Apple OAuth
        </button>
      )}
      {session && (
        <button
          onClick={async () => {
            await handleAddOAuthProvider({
              providerName: OAuthProviders.FACEBOOK,
              stampWith: StamperType.Passkey,
            });
          }}
          style={{
            backgroundColor: "rebeccapurple",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Add Facebook OAuth
        </button>
      )}
      {session && (
        <button
          onClick={async () => {
            await handleAddEmail({
              successPageDuration: 5000,
            });
          }}
          style={{
            backgroundColor: "rebeccapurple",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Add Email
        </button>
      )}

      {session && (
        <button
          onClick={async () => {
            await handleAddPhoneNumber({
              successPageDuration: 5000,
            });
          }}
          style={{
            backgroundColor: "rebeccapurple",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Add Phone Number
        </button>
      )}

      {session && (
        <button
          onClick={async () => {
            await handleAddPasskey({
              successPageDuration: 5000,
              stampWith: StamperType.Passkey,
            });
          }}
          style={{
            backgroundColor: "rebeccapurple",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Add Passkey
        </button>
      )}

      {session && (
        <button
          onClick={async () => {
            const providerId = user?.oauthProviders?.[0]?.providerId;
            if (!providerId) {
              console.error("No OAuth provider found to remove");
              return;
            }
            await handleRemoveOAuthProvider({
              providerId: providerId,
              stampWith: StamperType.Passkey,
            });
          }}
          style={{
            backgroundColor: "rebeccapurple",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Remove OAuth Provider
        </button>
      )}
      {session && (
        <button
          onClick={async () => {
            const authenticatorId = user?.authenticators?.[0]?.authenticatorId;
            if (!authenticatorId) {
              console.error("No passkey found to remove");
              return;
            }
            await handleRemovePasskey({
              authenticatorId: authenticatorId,
              stampWith: StamperType.Passkey,
            });
          }}
          style={{
            backgroundColor: "rebeccapurple",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Remove Passkey
        </button>
      )}
      {session && (
        <button
          onClick={handleLinkExternalWallet}
          style={{
            backgroundColor: "rebeccapurple",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Link Wallet
        </button>
      )}
      {session && (
        <button
          onClick={async () => {
            await createWalletAccounts({
              accounts: ["ADDRESS_FORMAT_SOLANA", "ADDRESS_FORMAT_ETHEREUM"],
              walletId: wallets[0]?.walletId!,
              organizationId: session?.organizationId!,
              stampWith: StamperType.Passkey,
            });
            console.log("Wallet accounts created successfully");
          }}
          style={{
            backgroundColor: "rebeccapurple",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Create Wallet Accounts
        </button>
      )}
    </main>
  );
}
