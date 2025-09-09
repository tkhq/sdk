import { test, expect } from "@playwright/test";
import { walletKitSelectors, withSdkJsSelectors } from "./helpers/selectors";
import { authenticateWithPasskey } from "./shared/auth";
import { waitForConsole } from "./helpers/console-listener";

const NEW_SESSION_KEY = "new-session-key";
const DEFAULT_SESSION_KEY = "@turnkey/session/v3";

test.beforeEach(async ({ page }) => {
  await authenticateWithPasskey(page);
});

test("log in to new session and verify getAllSessions updates", async ({
  page,
}) => {
  const whenConsole = waitForConsole(
    page,
    /Successfully called getAllSessions/,
    ["log"],
  );
  await page
    .getByTestId(withSdkJsSelectors.sessionManagement.getAllSessions)
    .click();

  const msg = await whenConsole;
  expect(msg.text).toMatch(/Successfully called getAllSessions/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);

  await page
    .getByTestId(withSdkJsSelectors.multiSessionManagement.sessionKeyInput)
    .fill(NEW_SESSION_KEY);
  await page
    .getByTestId(
      withSdkJsSelectors.multiSessionManagement.loginWithSessionKeyButton,
    )
    .click();

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
  await expect(
    page.getByTestId(withSdkJsSelectors.multiSessionManagement.activeSession),
  ).toHaveText(NEW_SESSION_KEY);
  await expect(
    page.getByTestId("switch-session-" + NEW_SESSION_KEY),
  ).toBeVisible();
  await expect(
    page.getByTestId("switch-session-" + DEFAULT_SESSION_KEY),
  ).toBeVisible();
});
