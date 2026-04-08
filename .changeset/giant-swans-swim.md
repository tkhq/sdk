---
"@turnkey/react-native-wallet-kit": major
---

### Secondary client IDs

**What changed:** Each OAuth provider in `TurnkeyProviderConfig.auth.oauth` is now configured via a per-provider type with `primaryClientId` and `secondaryClientIds` fields. Every `handle*Oauth` function accepts the same `primaryClientId` / `secondaryClientIds` overrides on a per-call basis.

`secondaryClientIds` are additional client IDs that get linked to the user during sign-up: they're decoded into `oidcClaims` (`{ iss, sub, aud }`) sharing the same identity as the primary OIDC token and registered as additional audiences during sub-organization creation. This lets a user who signed in with one client ID on one platform sign in with a different client ID on another platform and resolve to the same sub-organization. Existing users can call `addOauthProvider` with `oidcClaims` to retroactively link new audiences.

```ts
// before
<TurnkeyProvider
  config={{
    auth: {
      oauth: {
        google: { clientId: "<google-client-id>" },
        apple: { clientId: "<apple-services-id>" },
      },
    },
  }}
/>;

// after
<TurnkeyProvider
  config={{
    auth: {
      oauth: {
        google: {
          primaryClientId: "<google-client-id>",
          secondaryClientIds: ["<google-client-id-2>"],
        },
        apple: {
          // Apple's primaryClientId is now an object with the iOS bundle ID and
          // web/Android Services ID. See the new handleAppleOauth section below.
          primaryClientId: {
            iosBundleId: "<your-app-bundle-id>",
            serviceId: "<apple-services-id>",
          },
          secondaryClientIds: ["<another-services-id>"],
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

### Native Apple Sign-In: `handleAppleOauth`

**What changed:** `handleAppleOauth` now uses native Apple Sign-In on iOS (via `@invertase/react-native-apple-authentication`) and a web-based fallback on Android. Apple's `primaryClientId` is now an object: `{ iosBundleId, serviceId }`.

- On iOS, the native flow uses `iosBundleId` as the audience and links `serviceId` as a secondary audience during sub-organization creation.
- On Android, the web flow uses `serviceId` as the audience and links `iosBundleId` as a secondary audience.
- Any `secondaryClientIds` are linked alongside as additional audiences on both platforms.

```ts
// triggers native Apple sign-in on iOS, web flow on Android
await handleAppleOauth();

// per-call override
await handleAppleOauth({
  primaryClientId: {
    iosBundleId: "<your-app-bundle-id>",
    serviceId: "<apple-services-id>",
  },
  secondaryClientIds: ["<another-services-id>"],
});
```

---

### `handleAppleWebOauth` (deprecated)

**What changed:** The previous web-based Apple OAuth flow is preserved as `handleAppleWebOauth` for backwards compatibility. It opens the in-app browser to Apple's web OAuth flow on all platforms using `primaryClientId.serviceId` as the audience and ignores `iosBundleId`. New integrations should use `handleAppleOauth` instead.

```ts
// deprecated — kept for backwards compatibility with previous versions
await handleAppleWebOauth();
```
