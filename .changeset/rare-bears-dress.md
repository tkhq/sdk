---
"@turnkey/react-wallet-kit": major
---

### Auth modal config moved to `ui.authModal`

**What changed:** `methods`, `methodOrder`, and `oauthOrder` moved from `TurnkeyProviderConfig.auth` to `TurnkeyProviderConfig.ui.authModal`.

```ts
// before
<TurnkeyProvider
  config={{
    auth: {
      methods: {
        googleOauthEnabled: true,
        emailOtpAuthEnabled: true,
      },
      methodOrder: ["socials", "email"],
      oauthOrder: ["google", "apple"],
    },
  }}
/>;

// after
<TurnkeyProvider
  config={{
    ui: {
      authModal: {
        methods: {
          googleOauthEnabled: true,
          emailOtpAuthEnabled: true,
        },
        methodOrder: ["socials", "email"],
        oauthOrder: ["google", "apple"],
      },
    },
  }}
/>;
```

---

### Secondary client IDs

**What changed:** Each OAuth provider in `TurnkeyProviderConfig.auth.oauthConfig` is now configured via a nested `OauthProviderConfig` object (`{ primaryClientId, secondaryClientIds }`) instead of flat `*ClientId` strings. Every `handle*Oauth` function and `handleAddOauthProvider` accept the same `primaryClientId` / `secondaryClientIds` overrides on a per-call basis.

`secondaryClientIds` are additional client IDs that get linked to the user during sign-up: they're decoded into `oidcClaims` (`{ iss, sub, aud }`) sharing the same identity as the primary OIDC token and registered as additional audiences during sub-organization creation. This lets a user who signed in with one client ID on one platform sign in with a different client ID on another platform and resolve to the same sub-organization. Existing users can call `addOauthProvider` with `oidcClaims` to retroactively link new audiences.

```ts
// before
<TurnkeyProvider
  config={{
    auth: {
      oauthConfig: {
        googleClientId: "<google-client-id>",
        appleClientId: "<apple-services-id>",
      },
    },
  }}
/>;

// after
<TurnkeyProvider
  config={{
    auth: {
      oauthConfig: {
        google: {
          primaryClientId: "<google-client-id>",
          secondaryClientIds: ["<google-client-id-2>"],
        },
        apple: {
          primaryClientId: "<apple-services-id>",
        },
      },
    },
  }}
/>;
```

---

### `handle*Oauth` params

**What changed:** Renamed `clientId` → `primaryClientId` and added `secondaryClientIds` to every `handle*Oauth` function (`handleGoogleOauth`, `handleAppleOauth`, `handleFacebookOauth`, `handleXOauth`, `handleDiscordOauth`). Per-call overrides take precedence over the values from `TurnkeyProviderConfig`.

```ts
// before
await handleGoogleOauth({ clientId: "<google-client-id>" });

// after
await handleGoogleOauth({
  primaryClientId: "<google-client-id>",
  secondaryClientIds: ["<google-client-id-2>"],
});
```

---

### `handleAddOauthProvider`

**What changed:** Added `primaryClientId` and `secondaryClientIds`. Any `secondaryClientIds` (from the call or from `TurnkeyProviderConfig`) are decoded into `oidcClaims` and forwarded to `addOauthProvider`, registering them as additional audiences on the new provider entry alongside the primary OIDC token.

```ts
// add a new Google provider, linking an additional Google client ID as a secondary audience
await handleAddOauthProvider({
  providerName: OAuthProviders.GOOGLE,
  primaryClientId: "<google-client-id>",
  secondaryClientIds: ["<google-client-id-2>"],
});
```
