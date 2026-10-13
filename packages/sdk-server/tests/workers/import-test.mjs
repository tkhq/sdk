import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

test("sdk-server imports in Workers without Node compatibility", async (t) => {
  const { outputFiles } = await build({
    entryPoints: [
      fileURLToPath(new URL("./import-worker.js", import.meta.url)),
    ],
    bundle: true,
    format: "esm",
    platform: "browser",
    // Keep all exports so the actions module cannot be removed by the bundler.
    treeShaking: false,
    write: false,
  });

  const worker = new Miniflare({
    modules: true,
    script: outputFiles[0].text,
    compatibilityDate: "2026-07-01",
    compatibilityFlags: [],
  });
  t.after(() => worker.dispose());

  const response = await worker.dispatchFetch("https://example.com");
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.processType, "undefined");
  assert.equal(result.turnkeyType, "function");
  assert.ok(result.actions.includes("getSuborgs"));
  assert.ok(result.actions.includes("sendOtp"));
});
