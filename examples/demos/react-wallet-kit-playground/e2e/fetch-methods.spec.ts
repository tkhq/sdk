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

test("getWhoamiWithTempClient", async ({ page }) => {
  // First wait for the "passkey" log
  const whenPasskey = waitForConsole(
    page,
    /tempPasskeyClient StamperType:passkey/,
    ["log"],
  );

  // Also wait for the "apiKey" log
  const whenApiKey = waitForConsole(
    page,
    /notTempApiKeyClient StamperType:api-key/,
    ["log"],
  );

  // Trigger the button
  await page.getByTestId("get-whoami-temp-client").click();

  // Verify the "passkey" message
  const passkeyMsg = await whenPasskey;
  expect(passkeyMsg.text).toMatch(/tempPasskeyClient StamperType:passkey/);
  expect(passkeyMsg.type).toBe("log");
  expect(passkeyMsg.location().url).toMatch(/page.tsx$/);

  // Verify the "apiKey" message
  const apiKeyMsg = await whenApiKey;

  expect(apiKeyMsg.text).toMatch(/notTempApiKeyClient StamperType:api-key/);
  expect(apiKeyMsg.type).toBe("log");
  expect(apiKeyMsg.location().url).toMatch(/page.tsx$/);
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
