"use server";

import {
  Turnkey as TurnkeyServerSDK,
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
} from "@turnkey/sdk-server";

const turnkey = new TurnkeyServerSDK({
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
});

export async function getSuborgsAction(params: { filterValue: string }) {
  return await turnkey.apiClient().getSubOrgIds({
    organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    filterType: "OIDC_TOKEN",
    filterValue: params.filterValue,
  });
}

export async function createSuborgAction(params: {
  oauthProviders: Array<{ providerName: string; oidcToken: string }>;
}) {
  return await turnkey.apiClient().createSubOrganization({
    subOrganizationName: `telegram-suborg-${Date.now()}`,
    rootQuorumThreshold: 1,
    rootUsers: [
      {
        userName: `telegram-user-${Date.now()}`,
        apiKeys: [],
        authenticators: [],
        oauthProviders: params.oauthProviders,
      },
    ],
    wallet: {
      walletName: "Default Wallet",
      accounts: [...DEFAULT_ETHEREUM_ACCOUNTS, ...DEFAULT_SOLANA_ACCOUNTS],
    },
  });
}

export async function authAction(params: {
  suborgID: string;
  oidcToken: string;
  publicKey: string;
}) {
  const { session } = await turnkey.apiClient().oauthLogin({
    oidcToken: params.oidcToken,
    publicKey: params.publicKey,
    organizationId: params.suborgID,
  });
  if (!session) throw new Error("No session returned");
  return { session };
}

// Exchange a Telegram authorization code for an ID token.
// The client_secret must stay server-side — never expose it to the browser.
//
// Note: if Telegram ever supports PKCE-only (no client_secret) for public clients,
// the Authorization header can be removed and this action becomes unnecessary.
export async function exchangeTelegramCodeAction(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<{ idToken: string }> {
  const botId = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID!;
  const botSecret = process.env.TELEGRAM_BOT_SECRET!;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: botId,
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });

  const credentials = Buffer.from(`${botId}:${botSecret}`).toString("base64");

  const response = await fetch("https://oauth.telegram.org/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Telegram token exchange failed: ${err}`);
  }

  const data = await response.json();
  if (!data.id_token)
    throw new Error(
      `No id_token in Telegram response: ${JSON.stringify(data)}`,
    );

  return { idToken: data.id_token };
}
