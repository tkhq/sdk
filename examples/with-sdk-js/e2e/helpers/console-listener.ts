import type { Page, ConsoleMessage } from "@playwright/test";

// Playwright console types:
type ConsoleType = "log" | "info" | "debug" | "warning" | "error";

export async function waitForConsole(
  page: Page,
  re: RegExp,
  types: ConsoleType[] = ["log"], // default: normal console.log
): Promise<{
  text: string;
  type: ConsoleType;
  location: ConsoleMessage["location"];
}> {
  const msg = await page.waitForEvent("console", (m) => {
    const t = m.type() as ConsoleType;
    return (types as string[]).includes(t) && re.test(m.text());
  });
  return {
    text: msg.text(),
    type: msg.type() as ConsoleType,
    location: () => msg.location(),
  };
}
