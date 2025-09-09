import { test, expect, Page } from "@playwright/test";
import { withSdkJsSelectors } from "./helpers/selectors";
import { authenticateWithPasskey } from "./shared/auth";
import { waitForConsole } from "./helpers/console-listener";

test.beforeEach(async ({ page }) => {
  await authenticateWithPasskey(page);
});

test("getActiveSession", async ({ page }) => {
  const whenConsole = waitForConsole(
    page,
    /Successfully called getActiveSession/,
    ["log"],
  );
  await page
    .getByTestId(withSdkJsSelectors.sessionManagement.getActiveSession2)
    .click();

  const msg = await whenConsole;
  expect(msg.text).toMatch(/Successfully called getActiveSession/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});

test("getAllSessions", async ({ page }) => {
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
});

test("clearActiveSession", async ({ page }) => {
  const whenConsole = waitForConsole(
    page,
    /Successfully called clearActiveSession/,
    ["log"],
  );
  await page
    .getByTestId(withSdkJsSelectors.sessionManagement.clearActiveSession)
    .click();

  const msg = await whenConsole;
  expect(msg.text).toMatch(/Successfully called clearActiveSession/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});

test("clearAllSessions", async ({ page }) => {
  const whenConsole = waitForConsole(
    page,
    /Successfully called clearAllSessions/,
    ["log"],
  );
  await page
    .getByTestId(withSdkJsSelectors.sessionManagement.clearAllSessions)
    .click();

  const msg = await whenConsole;
  expect(msg.text).toMatch(/Successfully called clearAllSessions/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});

test("refreshActiveSession", async ({ page }) => {
  const whenConsole = waitForConsole(
    page,
    /Successfully called refreshActiveSession/,
    ["log"],
  );
  await page
    .getByTestId(withSdkJsSelectors.sessionManagement.refreshActiveSession)
    .click();

  const msg = await whenConsole;
  expect(msg.text).toMatch(/Successfully called refreshActiveSession/);
  expect(msg.type).toBe("log");
  expect(msg.location().url).toMatch(/page.tsx$/);
});
