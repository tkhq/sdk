"use client";

import "@turnkey/react-wallet-kit/dist/styles.css";
import "./global.css";
import { TurnkeyConfigProvider } from "@/providers/config/ConfigProvider";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { Slide, ToastContainer, toast } from "react-toastify";

interface RootLayoutProps {
  children: React.ReactNode;
}

function RootLayout({ children }: RootLayoutProps) {
  const notify = (message: String) =>
    toast.error("Error: " + message, {
      position: "bottom-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: false,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      transition: Slide,
    });

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Turnkey Demo EWK</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="bg-background-light dark:bg-background-dark">
        <TurnkeyConfigProvider
          initialConfig={{
            apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
            authProxyUrl: process.env.NEXT_PUBLIC_AUTH_PROXY_URL!,
            authProxyId: process.env.NEXT_PUBLIC_AUTH_PROXY_ID!,
            organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
            importIframeUrl: process.env.NEXT_PUBLIC_IMPORT_IFRAME_URL!,
            exportIframeUrl: process.env.NEXT_PUBLIC_EXPORT_IFRAME_URL!,
            auth: {
              oAuthConfig: {
                googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
                appleClientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID,
                facebookClientId: process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID,
                oAuthRedirectUri: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI,
                openOAuthInPage: true,
              },
              methods: {
                emailOtpAuthEnabled: true,
                smsOtpAuthEnabled: false,
                passkeyAuthEnabled: true,
                walletAuthEnabled: true,
                googleOAuthEnabled: true,
                appleOAuthEnabled: false,
                facebookOAuthEnabled: false,
              },
              methodOrder: ["socials", "email", "sms", "passkey", "wallet"],
              oauthOrder: ["google", "apple", "facebook"],
              autoRefreshSession: true,
              createSuborgParams: {
                emailOtpAuth: {
                  customWallet: {
                    walletName: "Wallet 1",
                    walletAccounts: [
                      {
                        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
                        curve: "CURVE_SECP256K1",
                        pathFormat: "PATH_FORMAT_BIP32",
                        path: "m/44'/60'/0'/0/0",
                      },
                      {
                        addressFormat: "ADDRESS_FORMAT_SOLANA",
                        curve: "CURVE_ED25519",
                        pathFormat: "PATH_FORMAT_BIP32",
                        path: "m/44'/501'/0'/0/0",
                      },
                    ],
                  },
                },
                smsOtpAuth: {
                  customWallet: {
                    walletName: "Wallet 1",
                    walletAccounts: [
                      {
                        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
                        curve: "CURVE_SECP256K1",
                        pathFormat: "PATH_FORMAT_BIP32",
                        path: "m/44'/60'/0'/0/0",
                      },
                      {
                        addressFormat: "ADDRESS_FORMAT_SOLANA",
                        curve: "CURVE_ED25519",
                        pathFormat: "PATH_FORMAT_BIP32",
                        path: "m/44'/501'/0'/0/0",
                      },
                    ],
                  },
                },
                passkeyAuth: {
                  customWallet: {
                    walletName: "Wallet 1",
                    walletAccounts: [
                      {
                        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
                        curve: "CURVE_SECP256K1",
                        pathFormat: "PATH_FORMAT_BIP32",
                        path: "m/44'/60'/0'/0/0",
                      },
                      {
                        addressFormat: "ADDRESS_FORMAT_SOLANA",
                        curve: "CURVE_ED25519",
                        pathFormat: "PATH_FORMAT_BIP32",
                        path: "m/44'/501'/0'/0/0",
                      },
                    ],
                  },
                },
                walletAuth: {
                  customWallet: {
                    walletName: "Wallet 1",
                    walletAccounts: [
                      {
                        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
                        curve: "CURVE_SECP256K1",
                        pathFormat: "PATH_FORMAT_BIP32",
                        path: "m/44'/60'/0'/0/0",
                      },
                      {
                        addressFormat: "ADDRESS_FORMAT_SOLANA",
                        curve: "CURVE_ED25519",
                        pathFormat: "PATH_FORMAT_BIP32",
                        path: "m/44'/501'/0'/0/0",
                      },
                    ],
                  },
                },
                oAuth: {
                  customWallet: {
                    walletName: "Wallet 1",
                    walletAccounts: [
                      {
                        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
                        curve: "CURVE_SECP256K1",
                        pathFormat: "PATH_FORMAT_BIP32",
                        path: "m/44'/60'/0'/0/0",
                      },
                      {
                        addressFormat: "ADDRESS_FORMAT_SOLANA",
                        curve: "CURVE_ED25519",
                        pathFormat: "PATH_FORMAT_BIP32",
                        path: "m/44'/501'/0'/0/0",
                      },
                    ],
                  },
                },
              },
            },
            ui: {
              darkMode: true,
              borderRadius: 16,
              backgroundBlur: 8,
              renderModalInProvider: true, // This is needed for the config panel to push the modal over
              colors: {
                light: {
                  primary: "#335bf9",
                },
                dark: {
                  primary: "#335bf9",
                },
              },
            },
            walletConfig: {
              ethereum: true,
              solana: true,
            },
          }}
          callbacks={{
            onError: (error) => {
              console.error("Turnkey Error:", error);
              notify(error.message);
            },
          }}
        >
          {children}
        </TurnkeyConfigProvider>
      </body>
    </html>
  );
}

export default RootLayout;
