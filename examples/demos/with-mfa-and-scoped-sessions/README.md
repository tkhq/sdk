# MFA Examples

This app demonstrates four ways to use Turnkey multi-factor authentication
(MFA) with email OTPs, passkeys, OAuth, and sessions, including how to recover an account
without weakening it.

## How MFA policies are evaluated

Read this first. Every scenario below depends on it.

MFA policies live **on the user**, not on the organization, and they are the only policy
type that constrains root users. Each policy has a `condition` and an `order`.

**Only the first matching policy applies.** Turnkey sorts a user's MFA policies by `order`,
evaluates each condition in turn, and stops at the first match. Policies do not stack. This
is why every scenario here puts its narrow policy at `order: 0` and its catch-all
(`condition: "true"`) last: reverse them and the catch-all would swallow everything.

Within one policy, `requiredAuthenticationMethods` entries are **ANDed**, and the `any`
array inside each entry is **ORed**. So this means "an email OTP or an SMS OTP, _and_ a
passkey":

```json
"requiredAuthenticationMethods": [
  { "any": [
      { "type": "AUTHENTICATION_TYPE_EMAIL_OTP" },
      { "type": "AUTHENTICATION_TYPE_SMS_OTP" }
  ]},
  { "any": [{ "type": "AUTHENTICATION_TYPE_PASSKEY" }] }
]
```

### Before copying this into production

**MFA policies fail closed, permanently.** If a required factor can no longer be satisfied,
every activity matching that condition is denied forever. Turnkey cannot bypass it, and
neither can the parent organization. A user who can still authenticate can delete the
offending policy themselves, which is what **Reset MFA policies** does here. A user who
cannot has no self-service route left: someone else in the same sub-organization has to
delete it for them. Scenarios 2, 3 and 4 all gate login itself on a passkey, so losing that
passkey with no second one enrolled is exactly that case. Scenario 4 is the one that builds a
way out. See
[MFA recovery](https://docs.turnkey.com/features/authentication/mfa/enforcement-and-recovery).

**Pinning an authenticator id is sharper still.** An `AuthenticationMethod` may carry an
`id` to require one specific credential. Delete that credential and nothing can ever satisfy
the requirement again.

**Policies cannot be created with the sub-organization.** There is no MFA field on
`CREATE_SUB_ORGANIZATION`, so there is always a window between creating a user and creating
their policies. In this demo you close it by clicking a button; in production your backend
or a delegated-access user should close it immediately after sign-up.

## The four MFA scenarios

### Scenario 1: require MFA when signing

The user logs in normally. Signing a message requires both:

- An active session
- Passkey approval

Use this pattern when most actions can use a session, but sensitive actions
such as signing should prompt the user for another factor.

### Scenario 2: require MFA when logging in

Login requires both:

- An email OTP
- Passkey approval

After login, the resulting session can authorize later actions without another
passkey prompt. The sign-message step proves it: the same action that prompts in Scenario 1
stays silent here.

Use this pattern when you want strong authentication at the start of a session
without prompting the user during normal activity.

### Scenario 3: require MFA when logging in and exporting a wallet

Login requires an email OTP and passkey. Normal activity requires only the
session, while wallet export requires the session plus another passkey
approval.

Use this pattern when login needs MFA and especially sensitive operations need
step-up authentication.

### Scenario 4: recover a passkey-only account

The user signs in with a passkey and nothing else. If they lose it, recovery takes an email
OTP **and** Google, and lands in a session scoped to enrolling a new credential. Logging in
with the email OTP alone gets them nowhere.

Use this pattern when you want a one-tap front door without making recovery the weak way in.

## Who stamps the login decides whether MFA applies

The easiest thing to get wrong here: **MFA is evaluated for the user whose credential stamped
the request**, not for the user the activity is about.

Every scenario stamps the login in the browser, which is what makes `activity.resource ==
'AUTH'` policies fire at all:

```ts
await verifyOtp({ otpId, otpCode, otpEncryptionTargetBundle });
await httpClient.stampStampLogin(
  { organizationId: subOrgId, publicKey },
  StamperType.Attested,
);
```

Those two lines look independent and are coupled through client state. `verifyOtp` quietly
calls `overrideAttestedStamper` with the verification token; `StamperType.Attested` then only
selects that stamper. The token is never an argument, so order matters, and dropping
`stampWith` falls back to the API key stamper, which is a different voter.

A backend that submits `OTP_LOGIN` or `OAUTH_LOGIN` with the parent organization's API key gets
the opposite result. Those activities are parent-initiated, so the voter is the parent API user
and the **sub-organization user's MFA policies are never consulted**. The login just succeeds,
with no error and no warning.

So if your login is backend-driven, keep `INIT_OTP` and `VERIFY_OTP` on the server, hand the
verification token to the browser, and let the browser stamp the login. The token is bound to a
client-generated key, so it is useless to anyone else.

## Handling the MFA challenge

An activity that trips a policy returns `ACTIVITY_STATUS_AUTHENTICATORS_NEEDED`.
`setMfaHandler` registers the callback that resolves it, and the SDK re-polls once your handler
returns.

**Registering one is required.** There is no built-in fallback UI, so without a handler the
activity comes back unfinished and fails downstream with something unrelated, such as "No
export bundle found in the response".

Your handler receives an `MfaContext` carrying `mfaStatuses`, the enclave's answer to what is
still missing. Read it rather than assuming a passkey, as `src/app/scenarios/mfa.ts` does.

With a handler registered, `handleLogin()` resolves MFA logins on its own, since the built-in
auth modal calls `completeOtp` underneath. Scenarios 2, 3 and 4 spell the flow out by hand in
`otpMfaLogin` anyway, because that is what you write when the login UI is yours.

## Setup

You need:

- Node.js 18 or newer
- `pnpm`
- A [Turnkey organization](https://app.turnkey.com/)
- An Auth Proxy configuration with email OTP enabled. Google too, for the full Scenario 4
- A browser that supports passkeys

**Scenario 4 also needs a session profile.** Create one in the dashboard under
[Security > Session profiles](https://app.turnkey.com/dashboard/v2/security/session-profiles)
with a scope of `activity.kind == 'CREATE_AUTHENTICATORS'` and a short expiry, 600 seconds is
plenty. Copy its id into `.env.local` below. Session profiles are owned by the parent
organization and cannot be updated or deleted once created, so a typo in the scope means
creating a new one.

From this example's directory, create your local environment file:

```bash
cp .env.local.example .env.local
```

Add your Turnkey organization ID and Auth Proxy configuration ID to
`.env.local`:

```bash
NEXT_PUBLIC_ORGANIZATION_ID="your-organization-id"
NEXT_PUBLIC_BASE_URL="https://api.turnkey.com"
NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID="your-auth-proxy-config-id"
NEXT_PUBLIC_AUTH_PROXY_BASE_URL="https://authproxy.turnkey.com"
NEXT_PUBLIC_EXPORT_IFRAME_URL="https://export.turnkey.com"

# Scenario 4 only
NEXT_PUBLIC_RECOVERY_SESSION_PROFILE_ID="your-recovery-session-profile-id"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-oauth-client-id"
NEXT_PUBLIC_OAUTH_REDIRECT_URI="http://localhost:3000"
```

Both Google variables are only needed if your auth proxy config does not already carry them.
The client ID and the redirect URI both come from the dashboard, and the values above simply
override them locally. Google needs both to start, and Scenario 4 tells you which one is
missing.

**Scenario 4 requires Google**, because it is the second recovery factor and the reason
recovery is not weaker than the passkey front door. The recovery login is itself stamped with
the email OTP, so a policy asking for nothing else would already be satisfied on arrival:
recovery would be exactly as strong as the inbox, and no challenge would ever appear. Scenario
4 will not create its policies until Google is linked.

Install and build the workspace from the repository root:

```bash
corepack enable
pnpm install
pnpm build-all
```

Start the example:

```bash
cd examples/demos/with-mfa-and-scoped-sessions
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Try scenario 1

1. Select **Scenario 1**.
2. Select **Login / Sign Up** and complete the email OTP flow. The scenario's steps appear
   once you have a session.
3. Select **Add Passkey** and register a passkey.
4. Select **Create MFA Policy**. A confirmation screen lists what was written to the user.
5. Select **Sign Message** and approve the passkey prompt.

## Try scenario 2

1. Select **Scenario 2**.
2. Select **Setup Login / Sign Up** to create the user.
3. Add a passkey and create the MFA policies.
4. Select **Logout Before Testing Auth**.
5. Enter the same email and select **Send Email OTP**.
6. Enter the code and select **Verify OTP + Passkey Login**.
7. Approve the passkey prompt.
8. Select **Sign Message**. It completes with no passkey prompt: the session alone satisfies
   the catch-all policy.

## Try scenario 3

1. Select **Scenario 3**.
2. Select **Initial Setup Login / Sign Up** to create the user. Sign-up creates the wallet.
3. Add a passkey and create the MFA policies.
4. Select **Logout Before Testing Auth**.
5. Log in again with the same email, OTP, and passkey.
6. Select **Export Wallet**, then **Confirm Export**.
7. Approve the additional passkey prompt.

## Try scenario 4

1. Select **Scenario 4**.
2. Select **Sign up with a passkey**. No email, no OAuth, just the passkey.
3. Select **Add or update the recovery email** and complete the OTP. The verification is the
   point: an email that is merely set, rather than verified, cannot be found at recovery time.
4. Select **Link Google**, the second recovery factor.
5. Select **Create MFA Policies**. Steps 3 and 4 have to come first, because Turnkey rejects a
   policy the user cannot yet satisfy. A checklist above the buttons tracks what is still
   missing, and the button stays disabled until all three exist.
6. Select **Log out (pretend the passkey is lost)**.
7. Enter the recovery email, select **Send Email OTP**, enter the code, then
   **Recover with email OTP + Google**. The email OTP is carried by the login's own stamp, so
   the outstanding factor is Google, and a Google popup appears to satisfy it.
8. You land in a recovery session. The card prints its profile id and scope.
9. Select **Try to sign a message**. It is denied by the session scope.
10. Select **Enrol a new passkey**, which the scope does allow. Log out and sign in with it.

Worth trying too: at step 7, use **Log in with the OTP alone** instead. That login names no
session profile, so it falls through to the order 1 policy, which wants the passkey. You still
hold the passkey here so you can complete the prompt, but a user who genuinely lost theirs is
stuck at that point, which is what stops the recovery email from becoming a back door.

Re-running the scenario is easiest via **Delete this sub-organization**, at the bottom of every
scenario once you have a session. Resetting the policies alone leaves the user, the verified
email and the linked Google account behind, and Google in particular cannot be re-linked to a
second sub-organization.

## Sessions in this demo

Each scenario keeps its own session. They pass a distinct `sessionKey` (`scenario-1` through
`scenario-4`) to `handleLogin` and `storeSession`, and read it back with
`allSessions?.[SESSION_KEY]`. Sessions are stored in `localStorage` on web, so all four
coexist, survive a page reload, and last until that scenario's Logout or until they expire.
Signing into Scenario 2 with one email while Scenario 1 holds another is expected: you are
logged in as three different users at once, which is the point of keying sessions.

Two consequences worth understanding before they surprise you.

**Only one session is active at a time.** The active session is what stamps requests and what
`user` and `wallets` describe. Switching tabs calls `setActiveSession` for the scenario you
moved to, but only if that scenario already has a session. Move to one that does not and the
previous scenario's session stays active, so `user` and `wallets` still describe the other
account while the card shows no session. Nothing acts on that mismatch, since every button is
gated on the scenario's own session, but the display is briefly misleading.

**Logout is per scenario.** `logout({ sessionKey })` clears only that session and its key
pair. To reset everything, log out of each scenario in turn, or clear the site's local
storage.

## Testing notes

MFA policies are saved on the Turnkey user, so scenarios interfere with each other if you
reuse one email. Use a different email per scenario, or clear up before switching with
**Reset MFA policies**, or **Delete this sub-organization** for a full reset. Without one of
those, creating the next scenario's policies fails with "mfa policy order must be unique",
since two policies cannot share an order.

Passkeys require `localhost` or HTTPS. If OTP login reports that no
sub-organization exists, first complete that scenario's setup login with the
same email address.
