"use client";

import "@turnkey/react-wallet-kit/styles.css";
import "./global.css";
import { TurnkeyConfigProvider } from "@/providers/config/ConfigProvider";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { Slide, toast } from "react-toastify";
import { initialConfig } from "@/constants";
import { TurnkeyErrorCodes } from "@turnkey/sdk-types";

interface RootLayoutProps {
  children: React.ReactNode;
}

function RootLayout({ children }: RootLayoutProps) {
  const notify = (message: String) =>
    toast.error("Error: " + message, {
      position: "bottom-right",
      autoClose: 5000,
      hideProgressBar: false,
      pauseOnFocusLoss: false,
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
          initialConfig={initialConfig}
          callbacks={{
            onError: (error) => {
              console.error("Turnkey Error:", error.code);
              switch (error.code) {
                case TurnkeyErrorCodes.ACCOUNT_ALREADY_EXISTS:
                  notify(
                    "This social login is already associated with another account.",
                  );
                  break;
                default:
                  notify(error.message);
              }
            },
            onAuthenticationSuccess: (result) => {
              console.log("Authentication successful:", result);
              // Handle successful authentication here
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
