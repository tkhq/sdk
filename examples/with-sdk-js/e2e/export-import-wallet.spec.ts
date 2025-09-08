import { test, expect } from "@playwright/test";
import { walletKitSelectors, withSdkJsSelectors } from "./helpers/selectors";
import { authenticateWithPasskey } from "./shared/auth";

test.beforeEach(async ({ page }) => {
  await authenticateWithPasskey(page);
});

test("export wallet", async ({ page }) => {
  await page.getByTestId(withSdkJsSelectors.createMethods.createWallet).click();
  await page.getByTestId("set-active-wallet-0").click();
  await page.getByTestId("set-active-wallet-account-0-0").click();
  await page.getByTestId(withSdkJsSelectors.modals.exportWalletModal).click();
  await expect(page.getByText("Keep your seed phrase private.")).toBeVisible();
  //   pause to let the modal animation finish
  await page.waitForTimeout(500);
  await page
    .getByTestId(walletKitSelectors.exportComponent.confirmExportButton)
    .click();
  await expect(
    page.getByText(
      "Your seed phrase is the key to your wallet. Save it in a secure location.",
    ),
  ).toBeVisible();
  await page
    .getByTestId(walletKitSelectors.exportComponent.exportDoneButton)
    .click();
});

test.describe("import wallet", () => {
  test("import wallet no mnemonic", async ({ page }) => {
    await page.getByTestId(withSdkJsSelectors.modals.importWalletModal).click();
    await expect(
      page.getByText(
        "Enter your seed phrase. Seed phrases are typically 12-24 words.",
      ),
    ).toBeVisible();
    await page
      .getByTestId(walletKitSelectors.importComponent.importWalletNameInput)
      .fill("Test Import");
    await page
      .getByTestId(walletKitSelectors.importComponent.confirmImportButton)
      .click();
    await expect(
      page.getByTestId(walletKitSelectors.importComponent.importErrorMessage),
    ).toHaveText(/no wallet mnemonic entered/);
  });
});
