# Example: `otp-auth`

This example shows how to implement [email OTP authentication](https://docs.turnkey.com/authentication/email) with Turnkey using the [@turnkey/react-wallet-kit](https://docs.turnkey.com/sdks/react).

It contains two separate implementations:

- **without-backend** - Uses Turnkey’s managed [Auth Proxy](https://docs.turnkey.com/reference/auth-proxy) to securely handle sign-up and login flows with origin enforcement and centralized configuration — no backend required. Your frontend interacts directly with Turnkey.
- **with-backend** - Demonstrates how to run the same authentication flow through **your own backend**.

**Auth Proxy Highlights**

- **Simplified setup:** No need to host or maintain your own authentication backend. The Auth Proxy is a managed, multi-tenant service that handles signing and forwarding authentication requests.
- **Built-in security:** Proxy keys are HPKE-encrypted inside Turnkey’s enclave and decrypted only in memory per request. Includes strict origin validation and CORS enforcement.
- **Centralized configuration:** Manage allowed origins, session lifetimes, email/SMS templates, and OAuth settings directly from the Turnkey Dashboard.
- **Faster development:** The frontend calls Auth Proxy endpoints directly — no backend endpoints needed for OTP, OAuth, or signup flows.

**Custom Backend Highlights**

You could:

- **User data:** Store and retrieve user data associated with Turnkey sub-organizations.
- **Metrics and monitoring:** Add custom validations, rate limiting, and logging.
- **Co-signing capabilities:** Enable 2/2 signing patterns where your application is a co-signer.
