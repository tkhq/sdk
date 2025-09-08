import { Page } from "playwright-core";
import * as WebAuthnUtils from "../helpers/WebAuthnUtils";
import { walletKitSelectors, withSdkJsSelectors } from "../helpers/selectors";
import { expect } from "@playwright/test";

export async function authenticateWithPasskey(page: Page) {
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
}
