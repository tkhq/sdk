import { test, expect } from "@playwright/test";
import { withSdkJsSelectors } from "./helpers/selectors";
import { authenticateWithPasskey } from "./shared/auth";
import { waitForConsole } from "./helpers/console-listener";

test.beforeEach(async ({ page }) => {
  await authenticateWithPasskey(page);
});

test("getWhoAmI", async ({ page }) => {
  const whenConsole = waitForConsole(page, /Successfully called getWhoami/, [
    "log",
  ]);
  await page.getByTestId(withSdkJsSelectors.fetchMethods.getWhoami).click();

  const msg = await whenConsole;
  expect(msg.text).toMatch(/Successfully called getWhoami/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});

test("getActiveSession", async ({ page }) => {
  const whenConsole = waitForConsole(
    page,
    /Successfully called getActiveSession/,
    ["log"],
  );
  await page
    .getByTestId(withSdkJsSelectors.fetchMethods.getActiveSession)
    .click();

  const msg = await whenConsole;
  expect(msg.text).toMatch(/Successfully called getActiveSession/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});

test("fetchUser", async ({ page }) => {
  const whenConsole = waitForConsole(page, /Successfully called fetchUser/, [
    "log",
  ]);
  await page.getByTestId(withSdkJsSelectors.fetchMethods.fetchUser).click();

  const msg = await whenConsole;
  expect(msg.text).toMatch(/Successfully called fetchUser/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});

test("fetchWallets", async ({ page }) => {
  const whenConsole = waitForConsole(page, /Successfully called fetchWallets/, [
    "log",
  ]);
  await page.getByTestId(withSdkJsSelectors.fetchMethods.fetchWallets).click();

  const msg = await whenConsole;
  expect(msg.text).toMatch(/Successfully called fetchWallets/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});

test("fetchWalletAccounts", async ({ page }) => {
  await page.getByTestId(withSdkJsSelectors.createMethods.createWallet).click();
  await page.getByTestId("set-active-wallet-0").click();
  const whenConsole = waitForConsole(
    page,
    /Successfully called fetchWalletAccounts/,
    ["log"],
  );
  await page
    .getByTestId(withSdkJsSelectors.fetchMethods.fetchWalletAccounts)
    .click();

  const msg = await whenConsole;
  expect(msg.text).toMatch(/Successfully called fetchWalletAccounts/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});

test("fetchWalletProviders", async ({ page }) => {
  const whenConsole = waitForConsole(
    page,
    /Successfully called fetchWalletProviders/,
    ["log"],
  );
  await page
    .getByTestId(withSdkJsSelectors.fetchMethods.fetchWalletProviders)
    .click();

  const msg = await whenConsole;
  expect(msg.text).toMatch(/Successfully called fetchWalletProviders/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});
