import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemo } from "../src/scenario.js";
import { verifyReceipt } from "../src/verification.js";
import { startWebServer } from "../src/server.js";
import { extractProofFromMeta } from "@kya-os/mcp";

test("real MCP calls require consent, enforce holder/scope binding, and reject revocation", async () => {
  const demo = await createDemo({ DEMO_MODE: "local" });
  try {
    const initial = await demo.call();
    assert.notEqual(initial.outcome, "allowed");
    assert.equal(initial.verification.valid, true);
    assert.equal(demo.state().executions, 0);

    await demo.approve();
    const credential = JSON.stringify(demo.state().delegation);
    const allowed = await demo.call();
    assert.equal(allowed.outcome, "allowed");
    assert.equal(allowed.verification.valid, true);
    assert.equal(demo.state().executions, 1);

    const replay = await demo.call("get_report", { replay: true });
    assert.notEqual(replay.outcome, "allowed");
    assert.equal(replay.verification.valid, true);
    assert.equal(demo.state().executions, 1);

    const wrongHolder = await demo.call("get_report", { holder: "issuer" });
    assert.notEqual(wrongHolder.outcome, "allowed");
    assert.equal(wrongHolder.verification.valid, true);
    assert.equal(demo.state().executions, 1);

    const wrongScope = await demo.call("delete_report");
    assert.notEqual(wrongScope.outcome, "allowed");
    assert.equal(wrongScope.verification.valid, true);
    const repeatedScope = await demo.call("get_report", { replay: true });
    assert.deepEqual(
      repeatedScope.receipt.request.params,
      wrongScope.receipt.request.params,
    );
    assert.equal(demo.state().executions, 1);

    const tampered = structuredClone(demo.state().delegation!);
    tampered.credentialSubject.delegation.constraints.scopes = [
      "reports:read",
      "reports:delete",
    ];
    const forged = await demo.call("delete_report", { credential: tampered });
    assert.notEqual(forged.outcome, "allowed");
    assert.equal(forged.verification.valid, true);
    assert.equal(demo.state().executions, 1);

    await demo.revoke();
    assert.equal(JSON.stringify(demo.state().delegation), credential);
    const revoked = await demo.call();
    assert.notEqual(revoked.outcome, "allowed");
    assert.equal(revoked.verification.valid, true);
    assert.equal(demo.state().executions, 1);
    assert.ok(
      demo
        .state()
        .signing.every((event) => event.activityId.startsWith("local-")),
    );
    assert.equal(JSON.stringify(demo.state()).includes("privateKey"), false);
  } finally {
    await demo.close();
  }
});

test("a public verifier detects altered results and the wrong expected server", async () => {
  const demo = await createDemo({ DEMO_MODE: "local" });
  try {
    await demo.approve();
    const { receipt } = await demo.call();
    const did = demo.state().identities.server!.did;
    assert.equal((await verifyReceipt(receipt, did)).valid, true);
    const changed = structuredClone(receipt);
    changed.response.content = [{ type: "text", text: "Forged report" }];
    assert.equal((await verifyReceipt(changed, did)).valid, false);
    const downgraded = structuredClone(receipt);
    const extracted = extractProofFromMeta(downgraded.response._meta ?? {});
    assert.ok(extracted.success);
    delete extracted.proof.meta.responseHash;
    assert.equal((await verifyReceipt(downgraded, did)).valid, false);
    await assert.rejects(
      verifyReceipt(receipt, demo.state().identities.issuer!.did),
      /expected server/,
    );
  } finally {
    await demo.close();
  }
});

test("the local HTTP app rejects cross-origin actions before signing", async () => {
  const demo = await createDemo({ DEMO_MODE: "local" });
  const web = await startWebServer(demo, 0);
  try {
    const blocked = await fetch(`${web.url}/api/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://untrusted.example",
      },
      body: JSON.stringify({ action: "approve" }),
    });
    assert.equal(blocked.status, 403);
    assert.equal(demo.state().delegation, null);
    assert.equal(demo.state().signing.length, 0);
    const page = await fetch(web.url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Turnkey × KYA-OS/);
    const approved = await fetch(`${web.url}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: web.url },
      body: JSON.stringify({ action: "approve" }),
    });
    assert.equal(approved.status, 200);
    assert.ok(demo.state().delegation);
  } finally {
    await web.close();
  }
});
