import { test, expect } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";

import { decryptSecretBundle } from "../turnkey";

// Captured from a real `export_secrets` activity against api.turnkey.com. The
// embedded private key was single-use and the plaintext is demo data, so the
// fixture carries no live credentials.
const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../__fixtures__/secret-payload.json"),
    "utf8",
  ),
);

test("decryptSecretBundle verifies the enclave signature and returns the plaintext", async () => {
  const plaintext = await decryptSecretBundle({
    secretPayload: fixture.secretPayload,
    embeddedPrivateKey: fixture.embeddedPrivateKey,
    organizationId: fixture.organizationId,
  });

  expect(plaintext).toBe(fixture.plaintext);
});
