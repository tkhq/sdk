# Example: `oauth-cross-platform`

Demonstrates **cross-platform OAuth identity registration** with Turnkey. Sign up once on the web and log in from any platform (iOS, Android) with no extra onboarding. For more context, see the [Multi-Platform Oauth Identites](https://docs.turnkey.com/features/authentication/social-logins#multi-platform-oauth-identities) docs.

> **Note:** This demo uses the web app as the sign-up platform, but the pattern works in either direction. Mobile-first sign-up with web as the secondary platform is equally valid.

## The problem

OAuth providers like Google issue a different `client_id` per platform (web, iOS, Android). Without extra setup, a user who creates an account on your web app cannot log in from your mobile app, because Turnkey sees a different `aud` claim and finds no matching identity.

## The solution

At web sign-up, register the user's iOS and Android `aud` values as `oidcClaims` alongside the verified web token. Because these secondary audiences share the same `iss`/`sub`, they are trusted by association. When the user later logs in from mobile, `getSubOrgIds` with `filterType: "OAUTH_CLAIM"` resolves the same sub-org regardless of which platform issued the token.

## Parts

| Part           | Directory                       | Description                                                                        |
| -------------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| Part 1: Web    | [`web/`](./web/README.md)       | Next.js app with Google sign-up, dashboard, and per-platform identity verification |
| Part 2: Mobile | [`mobile/`](./mobile/README.md) | React Native (Expo) app that logs in using the identities registered in Part 1     |

Start with Part 1, then run the mobile app to verify the cross-platform flow end-to-end.

## Testing convenience: Delete account

Both the web and mobile apps include a **Delete account** button. It is included purely as a convenience for iterating during development. Deleting a sub-organization can only be initiated by the authenticated user from within the app, so the button exists to make it easy to reset a test account and sign up again.

> 🚨 **Warning:** The button calls `deleteSubOrganization` with `deleteWithoutExport: true`. This **permanently and irreversibly deletes the sub-organization and all associated wallets**, even if private keys have never been exported. Do not surface this feature in production without additional safeguards.
