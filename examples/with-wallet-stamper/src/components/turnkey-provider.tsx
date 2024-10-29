import React, { createContext, useContext, useState, useEffect } from "react";
// import { TurnkeyProvider, useTurnkey } from "@turnkey/sdk-react";

import { createActivityPoller, type TurnkeyClient } from "@turnkey/http";

// Use this abstraction to make it easier to interact with iframes
// import { TurnkeyIframeClient, IframeStamper } from "@turnkey/sdk-browser";
import {
  Turnkey,
  IframeStamper,
  TurnkeyIframeClient,
  TurnkeyPasskeyClient,
  TurnkeySDKBrowserConfig,
  TurnkeyBrowserClient,
} from "@turnkey/sdk-browser";

import { useTurnkey as useReactTurnkey } from "@turnkey/sdk-react";

import { env } from "@/env.mjs";

const { NEXT_PUBLIC_ORGANIZATION_ID, NEXT_PUBLIC_BASE_URL } = env;

import {
  SolanaWalletInterface,
  TStamper,
  WalletInterface,
  WalletStamper,
  EvmWalletInterface,
} from "@turnkey/wallet-stamper";
import { createWebauthnStamper, Email } from "@/lib/turnkey";
import { createUserSubOrg, getSubOrgByPublicKey } from "@/lib/server";
import { ChainType } from "@/lib/types";
import { useWallet } from "@solana/wallet-adapter-react";

import { useRouter } from "next/navigation";
import { ACCOUNT_CONFIG_SOLANA } from "@/lib/constants";
import { User, Wallet } from "@/lib/types";

// Context for the TurnkeyClient
const TurnkeyContext = createContext<{
  turnkey: Turnkey | null;
  client: TurnkeyClient | null;
  passkeyClient: TurnkeyClient | null;
  walletClient: TurnkeyClient | null;
  getActiveIframeClient: () => Promise<TurnkeyIframeClient | null>;
  createSubOrg: (email?: Email, chainType?: ChainType) => Promise<void>;
  setWallet: (wallet: WalletInterface | null) => void;
  signInWithWallet: (email?: Email) => Promise<User | null>;
  getWallets: () => Promise<Wallet[]>;
  authenticating: boolean;
  user: User | null;
  createWallet: (walletName: string, callback: any) => Promise<void>;
}>({
  turnkey: null,
  client: null,
  passkeyClient: null,
  walletClient: null,
  getActiveIframeClient: async () => null,
  createSubOrg: async () => {},
  setWallet: () => {},
  signInWithWallet: async () => null,
  getWallets: async () => [],
  authenticating: false,
  user: null,
  createWallet: async () => {},
});

export const useTurnkey = () => useContext(TurnkeyContext);

interface TurnkeyProviderProps {
  children: React.ReactNode;
}

const clientConfig = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
};

export const TurnkeyProvider: React.FC<TurnkeyProviderProps> = ({
  children,
}) => {
  const { authIframeClient: iframeClient } = useReactTurnkey();
  const [turnkey, setTurnkey] = useState<Turnkey | null>(null);
  const [wallet, setWallet] = useState<WalletInterface | null>(null);
  const [client, setClient] = useState<TurnkeyClient | null>(null);
  const [passkeyClient, setPasskeyClient] = useState<TurnkeyClient | null>(
    null
  );
  const [walletClient, setWalletClient] = useState<TurnkeyClient | null>(null);
  const [authenticating, setAuthenticating] = useState(false);
  const [user, setUser] = useState<User | null>({
    organizationId: "",
    organizationName: "",
    userId: "",
    username: "",
  });

  const router = useRouter();

  useEffect(() => {
    if (wallet) {
      createTurnkeyClient(new WalletStamper(wallet)).then(setWalletClient);
    }
  }, [wallet]);

  useEffect(() => {
    const initPasskeyClient = async () => {
      const webauthnStamper = await createWebauthnStamper({
        rpId: "localhost",
      });
      createTurnkeyClient(webauthnStamper as TStamper).then(setPasskeyClient);
    };
    initPasskeyClient();
  }, []);

  const createTurnkeyClient = async (stamper: TStamper) => {
    const { TurnkeyClient } = await import("@turnkey/http");

    return new TurnkeyClient(clientConfig, stamper);
  };

  const getActiveIframeClient =
    async (): Promise<TurnkeyIframeClient | null> => {
      let currentClient = null;

      if (!iframeClient) {
        return null;
      }

      const localCredential = localStorage.getItem("CREDENTIAL_BUNDLE");

      if (!localCredential) {
        return null;
      }

      const injected = await iframeClient?.injectCredentialBundle(
        localCredential!
      );

      if (!injected) {
        return null;
      }

      if (injected) {
        await iframeClient?.getWhoami({
          organizationId: user?.organizationId ?? NEXT_PUBLIC_ORGANIZATION_ID!,
        });
        currentClient = iframeClient;
      }

      const whoami = await iframeClient!.getWhoami({
        organizationId: user?.organizationId ?? NEXT_PUBLIC_ORGANIZATION_ID!,
      });

      try {
        // check if the iframeClient is active
        const whoami = await iframeClient!.getWhoami({
          organizationId: user?.organizationId ?? NEXT_PUBLIC_ORGANIZATION_ID!,
        });
        currentClient = iframeClient;
      } catch (error: any) {
        console.error("unable to getwhoami", error);

        try {
          // if not, check if there's a valid credential in localStorage, and try to initialize an iframeClient with it
          const localCredential = localStorage.getItem("CREDENTIAL_BUNDLE");

          if (localCredential) {
            const injected = await iframeClient?.injectCredentialBundle(
              localCredential
            );
            if (injected) {
              await iframeClient?.getWhoami({
                organizationId:
                  user?.organizationId ?? NEXT_PUBLIC_ORGANIZATION_ID!,
              });
              currentClient = iframeClient;
            }
          }
        } catch (error: any) {
          console.error("unable to use iframe client", error);
        }
      }

      return currentClient;
    };

  async function createSubOrg(
    email?: Email,
    chainType: ChainType = ChainType.SOLANA
  ) {
    setAuthenticating(true);
    let publicKey = null;
    if (chainType === ChainType.SOLANA) {
      const solanaWallet = wallet as SolanaWalletInterface;
      publicKey = solanaWallet.recoverPublicKey();
    } else if (chainType === ChainType.EVM) {
      // TODO: coming soon!
      const evmWallet = wallet as EvmWalletInterface;
    }

    const res = await createUserSubOrg({
      email,
      publicKey,
      chainType,
    });

    setUser((prevUser) => ({
      ...prevUser,
      organizationId: res.subOrganizationId || "",
      organizationName: prevUser?.organizationName || "",
      userId: prevUser?.userId || "",
      username: prevUser?.username || "",
    }));

    setAuthenticating(false);
    router.push("/dashboard");
  }

  // Fetches a user's wallets.
  // While this uses the end-user authenticator (a wallet client or iframe client), this can also use 
  // the parent org's credentials, since the parent org has read-only access to all of its suborgs.
  async function getWallets(): Promise<Wallet[]> {
    if (!walletClient || !user?.organizationId) {
      return [];
    }

    let wallets = [];

    const iframeClient = await getActiveIframeClient();

    if (iframeClient) {
      const { wallets: walletsResponse } = await iframeClient.getWallets({
        organizationId: user?.organizationId,
      });
      wallets = walletsResponse;
    } else {
      const { wallets: walletsResponse } = await walletClient?.getWallets({
        organizationId: user?.organizationId,
      });
      wallets = walletsResponse;
    }

    return wallets as unknown as Wallet[];
  }

  // Sign in with wallet and create an active session
  async function signInWithWallet(email?: Email): Promise<User | null> {
    let whoami: User | null = null;

    if (!walletClient) {
      return null;
    }

    // If no email is provided, log in with wallet. Will require multiple approvals.
    if (!email) {
      const publicKey = (wallet as SolanaWalletInterface)?.recoverPublicKey();
      const { organizationIds } = await getSubOrgByPublicKey(publicKey); // One wallet request
      const organizationId = organizationIds[0];

      if (walletClient) {
        try {
          // Another wallet request
          whoami = await walletClient.getWhoami({
            organizationId,
          });
          setUser(whoami);
          router.push("/dashboard");
        } catch (e) {
          console.error(e);
        }
      }

      return whoami;
    }

    // Create an iframe session. Email is required for the next bit.
    try {
      const activityPoller = createActivityPoller({
        client: walletClient,
        requestFn: walletClient.createReadWriteSession,
      });

      const completedActivity = await activityPoller({
        type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION",
        timestampMs: new Date().getTime().toString(),
        organizationId: NEXT_PUBLIC_ORGANIZATION_ID, // This can accept the parent org if we don't know the suborg in advance
        parameters: {
          email: email!,
          targetPublicKey: iframeClient?.iframePublicKey!,
        },
      });

      const result = completedActivity.result.createReadWriteSessionResult;

      // Need to save resulting bundle and information.
      // This is required by the authIframeClient abstraction.
      localStorage.setItem("CREDENTIAL_BUNDLE", result?.credentialBundle!);
      localStorage.setItem(
        "@turnkey/current_user",
        JSON.stringify({
          userId: result?.userId,
          username: result?.username,
          organization: {
            organizationId: result?.organizationId,
            organizationName: result?.organizationName,
          },
        })
      );

      setUser({
        userId: result?.userId!,
        username: result?.username!,
        organizationId: result?.organizationId!,
        organizationName: result?.organizationName!,
      });
      router.push("/dashboard");
    } catch (e) {
      console.error(e);
    }

    return whoami;
  }

  async function createWallet(walletName: string, callback: any) {
    if (!walletClient || !user?.organizationId) {
      return;
    }

    const activeIframeClient = await getActiveIframeClient();

    // If an iframe client exists, let's try to use it
    if (activeIframeClient) {
      try {
        const result = await activeIframeClient.createWallet({
          walletName,
          accounts: [ACCOUNT_CONFIG_SOLANA],
        });

        callback();

        return;
      } catch (error) {
        console.error("unable to create wallet using iframe client", error);
      }
    }

    // We have a wallet client
    const activityPoller = createActivityPoller({
      client: walletClient,
      requestFn: walletClient.createWallet,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_WALLET",
      timestampMs: new Date().getTime().toString(),
      organizationId: user?.organizationId,
      parameters: {
        walletName,
        accounts: [ACCOUNT_CONFIG_SOLANA],
      },
    });

    callback();

    return;
  }

  return (
    <TurnkeyContext.Provider
      value={{
        turnkey,
        client,
        passkeyClient,
        walletClient,
        getActiveIframeClient,
        createSubOrg,
        setWallet,
        signInWithWallet,
        authenticating,
        user,
        getWallets,
        createWallet,
      }}
    >
      {children}
    </TurnkeyContext.Provider>
  );
};
