import { test, expect } from "@playwright/test";
import { withSdkJsSelectors } from "./helpers/selectors";
import { authenticateWithPasskey } from "./shared/auth";

test("sign message in modal", async ({ page }) => {
  await authenticateWithPasskey(page);
  await page.getByTestId(withSdkJsSelectors.createMethods.createWallet).click();
  await page.getByTestId("set-active-wallet-0").click();
  await page.getByTestId("set-active-wallet-account-0-0").click();
  await page.getByTestId(withSdkJsSelectors.modals.signingModal).click();
  await expect(
    page.getByText("Use your wallet to sign this message"),
  ).toBeVisible();
  // Can't sign right now since the org we use for our testing is out of free signatures
  // and with CI running a ton of tests, we go over the limit pretty quickly.
});
