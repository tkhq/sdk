import type { Page } from "@playwright/test";

export async function clearWebStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.evaluate(async () => {
    const dbs: any = (indexedDB as any).databases
      ? await (indexedDB as any).databases()
      : [];
    if (Array.isArray(dbs)) {
      await Promise.all(
        dbs.map(
          (d: any) =>
            new Promise<void>((res) => {
              const req = indexedDB.deleteDatabase(d.name);
              req.onsuccess = () => res();
              req.onerror = () => res();
              req.onblocked = () => res();
            }),
        ),
      );
    }
  });
}
