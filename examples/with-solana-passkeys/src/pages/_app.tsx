import { AppProps } from "next/app";
import Head from "next/head";

import { TurnkeyProvider } from "@turnkey/sdk-react";

const turnkeyConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  rpId: process.env.NEXT_PUBLIC_RPID!,
  serverSignUrl: process.env.NEXT_PUBLIC_SERVER_SIGN_URL!,
  iframeUrl: process.env.NEXT_PUBLIC_IFRAME_URL ?? "https://auth.turnkey.com", // not necessary for this example
};

function DemoSolanaPasskeys({ Component, pageProps }: AppProps) {
  return (
    <div>
      <TurnkeyProvider config={turnkeyConfig}>
        <Head>
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        </Head>
        <Component {...pageProps} />
      </TurnkeyProvider>
    </div>
  );
}

export default DemoSolanaPasskeys;
