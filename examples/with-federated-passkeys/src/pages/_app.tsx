'use client';

import { AppProps } from "next/app";
import Head from "next/head";

import { TurnkeyProvider } from "@turnkey/sdk-react";
import turnkeyConfig from "../turnkey.json";

function FederatedPasskeysDemo({ Component, pageProps }: AppProps) {
  return (
    <div>
      <TurnkeyProvider config={turnkeyConfig}>
        <div>hi</div>
        {/* <Head>
        <link
          rel="icon"
          type="image/svg+xml"
          href="/favicon.svg"
        />
      </Head>
      <Component {...pageProps} /> */}
      </TurnkeyProvider>
    </div>
  );
}

export default FederatedPasskeysDemo;
