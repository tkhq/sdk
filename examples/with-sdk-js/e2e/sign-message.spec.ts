import { test, expect } from "@playwright/test";
import { withSdkJsSelectors } from "./helpers/selectors";
import { authenticateWithPasskey } from "./shared/auth";
import { waitForConsole } from "./helpers/console-listener";

test("sign message in modal", async ({ page }) => {
  await authenticateWithPasskey(page);
  await page.getByTestId(withSdkJsSelectors.createMethods.createWallet).click();
  await page.getByTestId("set-active-wallet-0").click();
  await page.getByTestId("set-active-wallet-account-0-0").click();
  await page.getByTestId(withSdkJsSelectors.modals.signingModal).click();
  await expect(
    page.getByText("Use your wallet to sign this message"),
  ).toBeVisible();
  await page.getByTestId("sign-button").click();
  await expect(page.getByText("Message signed successfully!")).toBeVisible();
});

test("sign SOL transaction", async ({ page }) => {
  const whenConsole = waitForConsole(page, /Transaction Signature:/, ["log"]);
  await authenticateWithPasskey(page);
  await page.getByTestId(withSdkJsSelectors.createMethods.createWallet).click();
  await page.getByTestId("set-active-wallet-0").click();
  await page.getByTestId("set-active-wallet-account-0-1").click();
  await page
    .getByTestId(withSdkJsSelectors.signingMethods.signSolTransaction)
    .click();
  const msg = await whenConsole;

  console.log("msg", msg);
  expect(msg.text).toMatch(/Transaction Signature: [0-9a-f]+/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});

test("sign ETH transaction", async ({ page }) => {
  const whenConsole = waitForConsole(page, /Transaction Signature:/, ["log"]);
  await authenticateWithPasskey(page);
  await page.getByTestId(withSdkJsSelectors.createMethods.createWallet).click();
  await page.getByTestId("set-active-wallet-0").click();
  await page.getByTestId("set-active-wallet-account-0-0").click();
  await page
    .getByTestId(withSdkJsSelectors.signingMethods.signEthTransaction)
    .click();
  const msg = await whenConsole;

  console.log("msg", msg);
  expect(msg.text).toMatch(/Transaction Signature: [0-9a-f]+/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});

test("sign with viem", async ({ page }) => {
  const whenConsole = waitForConsole(page, /Viem Signature:/, ["log"]);
  await authenticateWithPasskey(page);
  await page.getByTestId(withSdkJsSelectors.createMethods.createWallet).click();
  await page.getByTestId("set-active-wallet-0").click();
  await page.getByTestId("set-active-wallet-account-0-0").click();
  await page
    .getByTestId(withSdkJsSelectors.signingMethods.signWithViem)
    .click();
  const msg = await whenConsole;

  console.log("msg", msg);
  expect(msg.text).toMatch(/Viem Signature: [0-9a-f]+/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});
