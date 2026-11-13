import "dotenv/config";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createDemo } from "./scenario";
import { verifyReceipt } from "./verification";

async function main() {
  const demo = await createDemo();
  try {
    const denied = await demo.call();
    assert.notEqual(denied.outcome, "allowed");
    assert.equal(denied.verification.valid, true);
    console.log(
      "1. No delegation: tool did not execute; server proof verified.",
    );

    await demo.approve();
    console.log("2. Human approved: issued a scoped, signed delegation.");

    const allowed = await demo.call();
    assert.equal(allowed.outcome, "allowed");
    assert.equal(allowed.verification.valid, true);
    assert.equal(demo.state().executions, 1);
    console.log("3. Authorized call: tool executed; response proof verified.");

    const altered = structuredClone(allowed.receipt);
    altered.response.content = [{ type: "text", text: "An altered report." }];
    assert.equal(
      (await verifyReceipt(altered, demo.state().identities.server!.did)).valid,
      false,
    );
    console.log("4. Altered result: independent verification rejected it.");

    const replay = await demo.call("get_report", { replay: true });
    assert.notEqual(replay.outcome, "allowed");
    assert.equal(demo.state().executions, 1);
    console.log("5. Replayed request: tool did not execute.");

    await demo.revoke();
    const revoked = await demo.call();
    assert.notEqual(revoked.outcome, "allowed");
    assert.equal(demo.state().executions, 1);
    console.log("6. Revoked delegation: tool did not execute.");

    const output = process.argv[2];
    if (output) {
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, JSON.stringify(allowed.receipt, null, 2) + "\n");
      console.log(`Public receipt: ${output}`);
    }
    console.log(`Expected server DID: ${demo.state().identities.server!.did}`);
    console.log(`Signing backend: ${demo.state().mode}`);
  } finally {
    await demo.close();
  }
}

main().catch(() => {
  console.error(
    "Demo failed. Check the configured signing keys and permissions.",
  );
  process.exitCode = 1;
});
