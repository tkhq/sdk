import { NextResponse } from "next/server";
import {
  DEFAULT_SOLANA_ACCOUNTS,
  Turnkey as TurnkeySDKClient,
} from "@turnkey/sdk-server";

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.auth_code) {
    return NextResponse.json({ error: "Missing auth_code" }, { status: 400 });
  }

  if (!body?.state) {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }

  if (!body?.public_key) {
    return NextResponse.json({ error: "Missing public_key" }, { status: 400 });
  }

  // in production your should check the state parameter to ensure that it matches what was generated
  if (body?.state != "random_state") {
    return NextResponse.json(
      { error: "Invalid state value received from X" },
      { status: 400 },
    );
  }

  // ensure the X_CLIENT_ID environment variable has been set
  if (!process.env.X_CLIENT_ID) {
    return NextResponse.json(
      {
        error:
          "Missing X_CLIENT_ID environment variable, please set it in .env.local",
      },
      { status: 400 },
    );
  }

  // ensure the X_REDIRECT_URI environment variable has been set
  if (!process.env.X_REDIRECT_URI) {
    return NextResponse.json(
      {
        error:
          "Missing X_REDIRECT_URI environment variable, please set it in .env.local",
      },
      { status: 400 },
    );
  }

  try {
    // construct a TurnkeyClient with the parent organization api key saved in .env.local
    // this is a server component and is never exposed to the client
    const turnkeyClient = new TurnkeySDKClient({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    // perform an Oauth2Authenticate activity with the parameters passed by the client that will respond with an OIDC token issued by Turnkey to be used with a future LoginWithOAuth or CreateSubOrganization activity
    const oauth2AuthenticateResponse = await turnkeyClient
      .apiClient()
      .oauth2Authenticate({
        oauth2CredentialId: process.env.OAUTH2_CREDENTIAL_ID!,
        authCode: body.auth_code,
        redirectUri: process.env.X_REDIRECT_URI!,
        codeVerifier: "base64_encoded_sha256(code_verifier)", // in production this value should be a random value and the codeChallenge will be the base64_encoded_sha256(code_verifier)
      });

    // check if there are any existing users with that OIDC token
    const getSubOrgIdsResponse = await turnkeyClient.apiClient().getSubOrgIds({
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      filterType: "OIDC_TOKEN",
      filterValue: oauth2AuthenticateResponse.oidcToken,
    });

    let subOrgId;

    if (getSubOrgIdsResponse.organizationIds.length == 0) {
      // if no user was found with that OIDC Token create a new sub-organization
      const subOrgName = "X sub-organization " + Date.now();
      const createSubOrgResponse = await turnkeyClient
        .apiClient()
        .createSubOrganization({
          subOrganizationName: subOrgName,
          rootQuorumThreshold: 1,
          rootUsers: [
            {
              userName: subOrgName,
              apiKeys: [],
              authenticators: [],
              oauthProviders: [
                {
                  providerName: "X",
                  oidcToken: oauth2AuthenticateResponse.oidcToken,
                },
              ],
            },
          ],
          wallet: {
            walletName: subOrgName + " wallet",
            accounts: [...DEFAULT_SOLANA_ACCOUNTS],
          },
        });

      subOrgId = createSubOrgResponse.subOrganizationId;
    } else if (getSubOrgIdsResponse.organizationIds.length > 1) {
      // multiple sub orgs with the same OIDC token, shouldn't be possible
      return NextResponse.json(
        { error: `Error performing OAuth 2.0 authentication` },
        { status: 400 },
      );
    } else {
      subOrgId = getSubOrgIdsResponse.organizationIds[0];
    }

    // a user was found with that OIDC token, try logging them in
    const loginWithOAuthResponse = await turnkeyClient.apiClient().oauthLogin({
      organizationId: subOrgId,
      oidcToken: oauth2AuthenticateResponse.oidcToken,
      publicKey: body?.public_key,
    });

    return NextResponse.json({
      ok: true,
      session: loginWithOAuthResponse.session,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Error performing OAuth 2.0 authentication: ${e}` },
      { status: 400 },
    );
  }
}
