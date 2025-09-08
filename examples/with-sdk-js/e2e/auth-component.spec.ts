import { test, expect, chromium } from "@playwright/test";
import {
  withSdkJsSelectors,
  walletKitSelectors,
  externalSelectors,
} from "./helpers/selectors";
import * as WebAuthnUtils from "./helpers/WebAuthnUtils";

test.describe("log in with oauth methods", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByTestId(withSdkJsSelectors.modals.authModal).click();
    await expect(page.getByText("Log in or sign up")).toBeVisible();
  });

  test("log in with google", async ({ page }) => {
    await page
      .getByTestId(walletKitSelectors.authComponent.googleOAuthButton)
      .click();
    await expect(page.getByText("Authenticating with Google...")).toBeVisible();
  });

  test("log in with facebook", async ({ page }) => {
    await page
      .getByTestId(walletKitSelectors.authComponent.facebookOAuthButton)
      .click();
    await expect(
      page.getByText("Authenticating with Facebook..."),
    ).toBeVisible();
  });

  test("log in with apple", async ({ page }) => {
    await page
      .getByTestId(walletKitSelectors.authComponent.appleOAuthButton)
      .click();
    await expect(page.getByText("Authenticating with Apple...")).toBeVisible();
  });

  test("log in with X", async ({ page }) => {
    await page
      .getByTestId(walletKitSelectors.authComponent.xOAuthButton)
      .click();
    await expect(page.getByText("Authenticating with X...")).toBeVisible();
  });

  test("log in with discord", async ({ page }) => {
    await page
      .getByTestId(walletKitSelectors.authComponent.discordOAuthButton)
      .click();
    await expect(
      page.getByText("Authenticating with Discord..."),
    ).toBeVisible();
  });
});

test.describe("log in with email OTP", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("log in with email OTP", async ({ page }) => {
    await page.getByTestId(withSdkJsSelectors.modals.authModal).click();
    await expect(page.getByText("Log in or sign up")).toBeVisible();
    await page
      .getByTestId(walletKitSelectors.authComponent.emailInput)
      .fill("test@example.com");
    await page
      .getByTestId(walletKitSelectors.authComponent.emailContinue)
      .click();
    await expect(
      page.getByText("Enter the 6-digit code we sent to"),
    ).toBeVisible();
    await expect(page.getByText("test@example.com")).toBeVisible();
  });
});

test.describe("auth with passkey", () => {
  test("sign up and log in with passkey", async ({ page }) => {
    await WebAuthnUtils.setupWebAuthn(page);
    const virtualAuthenticator = new WebAuthnUtils.VirtualAuthenticator(page, {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    });
    await virtualAuthenticator.init();
    await page.goto("/");
    await page.getByTestId(withSdkJsSelectors.modals.authModal).click();
    await expect(page.getByText("Log in or sign up")).toBeVisible();
    await page
      .getByTestId(walletKitSelectors.authComponent.passkeySignupButton)
      .click();
    await expect(
      page.getByText("Creating account with passkey..."),
    ).toBeVisible();

    // <WebAuthn Ceremony happens here>

    // Now we're authed in!
    await expect(
      page.getByTestId(withSdkJsSelectors.managedState.authStateValue),
    ).toHaveText("authenticated");
    await expect(
      page.getByTestId(withSdkJsSelectors.managedState.clientStateValue),
    ).toHaveText("ready");

    // Now log out and log back in again to test login flow
    await page.getByTestId(withSdkJsSelectors.authMethods.logoutButton).click();
    await expect(
      page.getByTestId(withSdkJsSelectors.managedState.authStateValue),
    ).toHaveText("unauthenticated");
    await expect(
      page.getByTestId(withSdkJsSelectors.managedState.clientStateValue),
    ).toHaveText("ready");

    await page.getByTestId(withSdkJsSelectors.modals.authModal).click();
    await expect(page.getByText("Log in or sign up")).toBeVisible();
    await page
      .getByTestId(walletKitSelectors.authComponent.passkeyLoginButton)
      .click();
    await expect(
      page.getByText("Authenticating with passkey..."),
    ).toBeVisible();

    // <WebAuthn Ceremony happens here>

    // Now we're authed in!
    await expect(
      page.getByTestId(withSdkJsSelectors.managedState.authStateValue),
    ).toHaveText("authenticated");
    await expect(
      page.getByTestId(withSdkJsSelectors.managedState.clientStateValue),
    ).toHaveText("ready");
  });
});

test.describe("auth with wallet", async () => {
  test("log in with wallet", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId(withSdkJsSelectors.modals.authModal).click();
    await expect(page.getByText("Log in or sign up")).toBeVisible();
    await page
      .getByTestId(walletKitSelectors.authComponent.walletAuthButton)
      .click();
    await expect(page.getByText("Select wallet provider")).toBeVisible();
  });
});
