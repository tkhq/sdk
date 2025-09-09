import { test, expect, type Page } from "@playwright/test";
import { walletKitSelectors, withSdkJsSelectors } from "./helpers/selectors";
import { authenticateWithPasskey } from "./shared/auth";

async function waitForAnyError(page: Page, re: RegExp): Promise<string> {
  return Promise.race<string>([
    page
      .waitForEvent("console", (m) => m.type() === "error" && re.test(m.text()))
      .then((m) => m.text()),
    page
      .waitForEvent("pageerror", (e) => re.test(e.message))
      .then((e) => e.message),
  ]);
}

test("disallow removing last auth method", async ({ page, baseURL }) => {
  await authenticateWithPasskey(page);

  await page.getByTestId(withSdkJsSelectors.modals.removePasskeyModal).click();

  // start waiting for the error BEFORE the click that triggers it
  const whenError = waitForAnyError(page, /Failed to remove passkey/);

  await page
    .getByTestId(walletKitSelectors.removePasskeyComponent.removePasskeyButton)
    .click();

  const errText = await whenError; // resolves on first matching console/page error
  expect(errText).toMatch(/Failed to remove passkey/);
});
