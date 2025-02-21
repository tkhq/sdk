import { AppProps } from "next/app";
import Head from "next/head";

import { TurnkeyProvider } from "@turnkey/sdk-react";

const turnkeyConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  rpId: process.env.NEXT_PUBLIC_RPID!,
  iframeUrl:
    process.env.NEXT_PUBLIC_AUTH_IFRAME_URL ?? "https://auth.turnkey.com",
  sessionType: "readWrite",
  storageType: "localStorage",
};
console.log("_app.tsx turnkeyConfig", turnkeyConfig);
function EmailAuth({ Component, pageProps }: AppProps) {
  return (
    <TurnkeyProvider config={turnkeyConfig}>
      <Head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </Head>
      <Component {...pageProps} />
    </TurnkeyProvider>
  );
}

export default EmailAuth;
